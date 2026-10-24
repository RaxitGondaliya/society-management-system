import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateAmenityInput,
  BookAmenityInput,
  AmenityBookingDecisionInput,
  AmenityQueryInput,
} from "./amenity.validation";

export class AmenityService {
  /**
   * Helper to resolve societyId for caller
   */
  private static async resolveSocietyId(user: AuthUserPayload): Promise<string> {
    if (user.societyId) {
      return user.societyId;
    }

    const membership = await prisma.unitMember.findFirst({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      include: { unit: true },
    });

    if (membership?.unit?.societyId) {
      return membership.unit.societyId;
    }

    const society = await prisma.society.findFirst();
    if (!society) {
      throw new AppError(404, "No society found in system");
    }
    return society.id;
  }

  /**
   * 1. Create Society Amenity (Admin only)
   */
  static async createAmenity(user: AuthUserPayload, input: CreateAmenityInput) {
    const societyId = await this.resolveSocietyId(user);

    // Enforce unique amenity name per society
    const existing = await prisma.amenity.findFirst({
      where: {
        societyId,
        name: { equals: input.name, mode: "insensitive" },
      },
    });

    if (existing) {
      throw new AppError(409, `An amenity named '${input.name}' already exists in this society.`);
    }

    const feePerHour = Number(input.feePerHour) || 0;
    const feePerDay = Number(input.feePerDay) || 0;
    const securityDeposit = Number(input.securityDeposit) || 0;
    const chargeType = feePerHour > 0 || feePerDay > 0 ? "PAID" : "FREE";
    const rentalFee = input.bookingType === "FULL_DAY" ? feePerDay : feePerHour;

    const amenity = await prisma.amenity.create({
      data: {
        societyId,
        name: input.name,
        description: input.description || null,
        bookingType: input.bookingType,
        chargeType,
        capacity: input.capacity,
        feePerHour: new Prisma.Decimal(feePerHour),
        feePerDay: new Prisma.Decimal(feePerDay),
        rentalFee: new Prisma.Decimal(rentalFee),
        securityDeposit: new Prisma.Decimal(securityDeposit),
        cautionDeposit: new Prisma.Decimal(securityDeposit),
        openTime: input.openTime,
        closeTime: input.closeTime,
        rules: input.rules && input.rules.length > 0 ? JSON.stringify(input.rules) : null,
      },
    });

    return {
      ...amenity,
      rules: amenity.rules ? JSON.parse(amenity.rules) : [],
    };
  }

  /**
   * 2. List All Active Society Amenities
   */
  static async listSocietyAmenities(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);

    const amenities = await prisma.amenity.findMany({
      where: { societyId, isActive: true },
      orderBy: { name: "asc" },
    });

    return amenities.map((a) => {
      let parsedRules: unknown = [];
      if (a.rules) {
        try {
          parsedRules = JSON.parse(a.rules);
        } catch {
          parsedRules = [a.rules];
        }
      }
      return {
        ...a,
        rules: parsedRules,
      };
    });
  }

  /**
   * 3. Book Amenity Facility (ACID Transaction with Conflict Prevention)
   */
  static async bookFacility(user: AuthUserPayload, input: BookAmenityInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Amenity
      const amenity = await tx.amenity.findUnique({
        where: { id: input.amenityId },
      });

      if (!amenity) {
        throw new AppError(404, "Amenity facility not found.");
      }

      if (!amenity.isActive) {
        throw new AppError(400, "This facility is currently inactive for reservations.");
      }

      // 2. Verify Unit & Resident Access
      const unit = await tx.unit.findUnique({
        where: { id: input.unitId },
      });

      if (!unit || unit.societyId !== amenity.societyId) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      if (user.role === "RESIDENT") {
        const isMember = await tx.unitMember.findFirst({
          where: {
            unitId: input.unitId,
            userId: user.id,
            approvalStatus: "APPROVED",
          },
        });

        if (!isMember) {
          throw new AppError(403, "You can only book amenities for your own registered flat.");
        }
      }

      // 3. Normalize booking date to midnight UTC
      const dateString = input.bookingDate.slice(0, 10);
      const bookingDate = new Date(`${dateString}T00:00:00.000Z`);
      const todayString = new Date().toISOString().slice(0, 10);

      if (dateString < todayString) {
        throw new AppError(400, "Facility booking date cannot be in the past.");
      }

      // 4. Resolve time windows and slot details
      let startTime = input.startTime;
      let endTime = input.endTime;
      let slotDetails: string;

      if (amenity.bookingType === "FULL_DAY") {
        startTime = amenity.openTime;
        endTime = amenity.closeTime;
        slotDetails = "FULL_DAY";
      } else {
        if (!startTime || !endTime) {
          throw new AppError(400, "startTime and endTime are required for slot-based amenities.");
        }

        // Validate within operating hours
        if (startTime < amenity.openTime || endTime > amenity.closeTime) {
          throw new AppError(
            400,
            `Requested slot (${startTime} - ${endTime}) falls outside facility operating hours (${amenity.openTime} - ${amenity.closeTime}).`
          );
        }

        slotDetails = `${startTime}-${endTime}`;
      }

      // 5. Strict Double-Booking Conflict Prevention
      const activeBookings = await tx.amenityBooking.findMany({
        where: {
          amenityId: amenity.id,
          bookingDate,
          status: { in: ["CONFIRMED", "PENDING"] },
        },
        include: {
          unit: { select: { unitNumber: true } },
        },
      });

      for (const existing of activeBookings) {
        // If existing is FULL_DAY, whole day is blocked
        if (existing.slotDetails === "FULL_DAY" || slotDetails === "FULL_DAY") {
          throw new AppError(
            409,
            `Double-Booking Conflict: '${amenity.name}' is already reserved on ${dateString} by Flat ${existing.unit.unitNumber}.`
          );
        }

        // Slot-based overlap test: (startA < endB && endA > startB)
        const existStart = existing.startTime || "00:00";
        const existEnd = existing.endTime || "23:59";

        if (existStart < endTime && existEnd > startTime) {
          throw new AppError(
            409,
            `Double-Booking Conflict: The time slot (${existStart} - ${existEnd}) on ${dateString} is already booked by Flat ${existing.unit.unitNumber}.`
          );
        }
      }

      // 6. Fee & Deposit Calculations
      let rentalAmount = 0;
      if (amenity.bookingType === "FULL_DAY") {
        rentalAmount = Number(amenity.feePerDay);
      } else {
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);
        const durationHours = Math.max(1, (endH * 60 + endM - (startH * 60 + startM)) / 60);
        rentalAmount = Math.round(Number(amenity.feePerHour) * durationHours * 100) / 100;
      }

      const cautionDeposit = Number(amenity.securityDeposit);
      const totalPaid = rentalAmount + cautionDeposit;

      // 7. Generate Unique Booking Reference: BKG-YYYYMM-XXXX-RRR
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const count = await tx.amenityBooking.count({
        where: {
          amenityId: amenity.id,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
      });
      const seq = String(count + 1).padStart(4, "0");
      const salt = Math.floor(100 + Math.random() * 900);
      const bookingReference = `BKG-${yearMonth}-${seq}-${salt}`;

      // 8. Create Amenity Booking
      const booking = await tx.amenityBooking.create({
        data: {
          bookingReference,
          amenityId: amenity.id,
          unitId: input.unitId,
          bookedByUserId: user.id,
          bookingDate,
          slotDetails,
          startTime,
          endTime,
          purpose: input.purpose || null,
          attendeesCount: input.attendeesCount || null,
          rentalAmount: new Prisma.Decimal(rentalAmount),
          cautionDeposit: new Prisma.Decimal(cautionDeposit),
          totalPaid: new Prisma.Decimal(totalPaid),
          paymentMode: totalPaid > 0 ? "ONLINE" : "FREE",
          status: "CONFIRMED",
          depositRefundStatus: cautionDeposit > 0 ? "PENDING" : "NA",
        },
        include: {
          amenity: {
            select: {
              id: true,
              name: true,
              bookingType: true,
              chargeType: true,
            },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              sectionWing: { select: { id: true, name: true } },
            },
          },
          bookedByUser: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      return booking;
    });
  }

  /**
   * 4. Cancel or Update Booking Status
   */
  static async cancelOrUpdateBooking(
    user: AuthUserPayload,
    bookingId: string,
    input: AmenityBookingDecisionInput
  ) {
    const booking = await prisma.amenityBooking.findFirst({
      where: {
        OR: [{ id: bookingId }, { bookingReference: bookingId }],
      },
      include: {
        amenity: true,
        unit: true,
      },
    });

    if (!booking) {
      throw new AppError(404, "Booking record not found.");
    }

    if (user.role === "RESIDENT") {
      let isAuthorized = booking.bookedByUserId === user.id;

      if (!isAuthorized) {
        const member = await prisma.unitMember.findFirst({
          where: {
            unitId: booking.unitId,
            userId: user.id,
            approvalStatus: "APPROVED",
          },
        });
        if (member) isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new AppError(403, "You can only cancel your own amenity bookings.");
      }

      const bookingDateStr = booking.bookingDate.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      if (bookingDateStr < todayStr) {
        throw new AppError(400, "Past bookings cannot be cancelled.");
      }

      if (input.status !== "CANCELLED") {
        throw new AppError(403, "Residents can only cancel bookings.");
      }
    }

    const updated = await prisma.amenityBooking.update({
      where: { id: booking.id },
      data: {
        status: input.status,
        cancellationReason: input.cancellationReason || input.notes || null,
        depositRefundStatus:
          input.status === "CANCELLED" && Number(booking.cautionDeposit) > 0
            ? "REFUNDED"
            : booking.depositRefundStatus,
      },
      include: {
        amenity: {
          select: { id: true, name: true, bookingType: true },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
      },
    });

    return updated;
  }

  /**
   * 5. Resident My Bookings History
   */
  static async getMyBookings(user: AuthUserPayload) {
    const memberships = await prisma.unitMember.findMany({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      select: { unitId: true },
    });
    const userUnitIds = memberships.map((m) => m.unitId);

    const bookings = await prisma.amenityBooking.findMany({
      where: {
        OR: [
          { bookedByUserId: user.id },
          ...(userUnitIds.length > 0 ? [{ unitId: { in: userUnitIds } }] : []),
        ],
      },
      orderBy: { bookingDate: "desc" },
      include: {
        amenity: {
          select: {
            id: true,
            name: true,
            bookingType: true,
            chargeType: true,
            openTime: true,
            closeTime: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
      },
    });

    return bookings;
  }

  /**
   * 6. Real-Time Amenity Schedule & Slot Availability
   */
  static async getAmenitySchedule(
    user: AuthUserPayload,
    amenityId: string,
    query: AmenityQueryInput
  ) {
    const amenity = await prisma.amenity.findUnique({
      where: { id: amenityId },
    });

    if (!amenity) {
      throw new AppError(404, "Amenity facility not found.");
    }

    const dateStr = query.date ? query.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const reservedBookings = await prisma.amenityBooking.findMany({
      where: {
        amenityId,
        bookingDate: targetDate,
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: {
        id: true,
        bookingReference: true,
        slotDetails: true,
        startTime: true,
        endTime: true,
        status: true,
        unit: {
          select: {
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    const isFullyBooked =
      amenity.bookingType === "FULL_DAY" && reservedBookings.length > 0;

    return {
      amenity: {
        id: amenity.id,
        name: amenity.name,
        bookingType: amenity.bookingType,
        chargeType: amenity.chargeType,
        feePerHour: Number(amenity.feePerHour),
        feePerDay: Number(amenity.feePerDay),
        securityDeposit: Number(amenity.securityDeposit),
        openTime: amenity.openTime,
        closeTime: amenity.closeTime,
        capacity: amenity.capacity,
      },
      date: dateStr,
      isFullyBooked,
      totalReservations: reservedBookings.length,
      reservedSlots: reservedBookings.map((b) => ({
        bookingReference: b.bookingReference,
        slotDetails: b.slotDetails,
        startTime: b.startTime,
        endTime: b.endTime,
        bookedByUnit: `${b.unit.sectionWing?.name || ""} - ${b.unit.unitNumber}`.trim(),
      })),
    };
  }
}
