import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("🌱 Starting Database Master Seeder...");

  // 1. Super Admin User
  const superAdmin = await prisma.user.upsert({
    where: { phone: "+919999000001" },
    update: {
      fullName: "Apex Super Administrator",
      role: "SUPER_ADMIN",
      email: "superadmin@society.demo",
      isActive: true,
    },
    create: {
      phone: "+919999000001",
      email: "superadmin@society.demo",
      fullName: "Apex Super Administrator",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  console.log(`✅ Super Admin configured: ${superAdmin.fullName} (${superAdmin.phone})`);

  // 2. Sub-Admin User
  const subAdmin = await prisma.user.upsert({
    where: { phone: "+919999000002" },
    update: {
      fullName: "Estate Sub Administrator",
      role: "SUB_ADMIN",
      email: "subadmin@society.demo",
      isActive: true,
    },
    create: {
      phone: "+919999000002",
      email: "subadmin@society.demo",
      fullName: "Estate Sub Administrator",
      role: "SUB_ADMIN",
      isActive: true,
    },
  });
  console.log(`✅ Sub-Admin configured: ${subAdmin.fullName} (${subAdmin.phone})`);

  // 3. Resident Users
  const resident1 = await prisma.user.upsert({
    where: { phone: "+919999000003" },
    update: {
      fullName: "Vikramaditya Sharma",
      role: "RESIDENT",
      email: "vikram@society.demo",
      isActive: true,
    },
    create: {
      phone: "+919999000003",
      email: "vikram@society.demo",
      fullName: "Vikramaditya Sharma",
      role: "RESIDENT",
      isActive: true,
    },
  });

  const resident2 = await prisma.user.upsert({
    where: { phone: "+919999000004" },
    update: {
      fullName: "Ananya Deshmukh",
      role: "RESIDENT",
      email: "ananya@society.demo",
      isActive: true,
    },
    create: {
      phone: "+919999000004",
      email: "ananya@society.demo",
      fullName: "Ananya Deshmukh",
      role: "RESIDENT",
      isActive: true,
    },
  });

  const guardUser = await prisma.user.upsert({
    where: { phone: "+919999000005" },
    update: {
      fullName: "Bhawani Singh",
      role: "GUARD",
      email: "guard@society.demo",
      isActive: true,
    },
    create: {
      phone: "+919999000005",
      email: "guard@society.demo",
      fullName: "Bhawani Singh",
      role: "GUARD",
      isActive: true,
    },
  });
  console.log("✅ Core Users (Residents & Security Guard) verified.");

  // 4. Fully Configured Demo Society
  const society = await prisma.society.upsert({
    where: { code: "DEMO-SOC-001" },
    update: {
      name: "Greenwood Heights Cooperative Housing Society",
      propertyType: "FLAT",
      address: "Plot 101, Palm Avenue, SG Highway, Ahmedabad, Gujarat 380054",
      bankAccountNo: "918273645543",
      bankIfsc: "HDFC0001234",
      bankBeneficiaryName: "Greenwood Heights CHS Maintenance Account",
      upiId: "greenwood.heights@hdfcbank",
      subscriptionPlan: "ACTIVE",
    },
    create: {
      code: "DEMO-SOC-001",
      name: "Greenwood Heights Cooperative Housing Society",
      propertyType: "FLAT",
      address: "Plot 101, Palm Avenue, SG Highway, Ahmedabad, Gujarat 380054",
      bankAccountNo: "918273645543",
      bankIfsc: "HDFC0001234",
      bankBeneficiaryName: "Greenwood Heights CHS Maintenance Account",
      upiId: "greenwood.heights@hdfcbank",
      subscriptionPlan: "ACTIVE",
    },
  });
  console.log(`✅ Demo Society configured: ${society.name} (Code: ${society.code})`);

  // 5. Section Wings
  let wingA = await prisma.sectionWing.findFirst({
    where: { societyId: society.id, name: "Wing A" },
  });
  if (!wingA) {
    wingA = await prisma.sectionWing.create({
      data: { societyId: society.id, name: "Wing A" },
    });
  }

  let wingB = await prisma.sectionWing.findFirst({
    where: { societyId: society.id, name: "Wing B" },
  });
  if (!wingB) {
    wingB = await prisma.sectionWing.create({
      data: { societyId: society.id, name: "Wing B" },
    });
  }
  console.log("✅ Section Wings (Wing A, Wing B) synchronized.");

  // 6. Sample Units
  const unit101 = await prisma.unit.upsert({
    where: {
      sectionWingId_unitNumber: {
        sectionWingId: wingA.id,
        unitNumber: "101",
      },
    },
    update: {
      floorNumber: 1,
      occupancyStatus: "OCCUPIED_OWNER",
    },
    create: {
      societyId: society.id,
      sectionWingId: wingA.id,
      unitNumber: "101",
      floorNumber: 1,
      occupancyStatus: "OCCUPIED_OWNER",
    },
  });

  const unit102 = await prisma.unit.upsert({
    where: {
      sectionWingId_unitNumber: {
        sectionWingId: wingA.id,
        unitNumber: "102",
      },
    },
    update: {
      floorNumber: 1,
      occupancyStatus: "OCCUPIED_TENANT",
    },
    create: {
      societyId: society.id,
      sectionWingId: wingA.id,
      unitNumber: "102",
      floorNumber: 1,
      occupancyStatus: "OCCUPIED_TENANT",
    },
  });

  const unit201 = await prisma.unit.upsert({
    where: {
      sectionWingId_unitNumber: {
        sectionWingId: wingB.id,
        unitNumber: "201",
      },
    },
    update: {
      floorNumber: 2,
      occupancyStatus: "VACANT",
    },
    create: {
      societyId: society.id,
      sectionWingId: wingB.id,
      unitNumber: "201",
      floorNumber: 2,
      occupancyStatus: "VACANT",
    },
  });
  console.log("✅ Sample Residential Units (101, 102, 201) synchronized.");

  // 7. Approved Resident Memberships
  const member1 = await prisma.unitMember.findFirst({
    where: { unitId: unit101.id, userId: resident1.id },
  });
  if (!member1) {
    await prisma.unitMember.create({
      data: {
        unitId: unit101.id,
        userId: resident1.id,
        memberType: "OWNER",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  } else {
    await prisma.unitMember.update({
      where: { id: member1.id },
      data: {
        memberType: "OWNER",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  }

  const member2 = await prisma.unitMember.findFirst({
    where: { unitId: unit102.id, userId: resident2.id },
  });
  if (!member2) {
    await prisma.unitMember.create({
      data: {
        unitId: unit102.id,
        userId: resident2.id,
        memberType: "TENANT",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  } else {
    await prisma.unitMember.update({
      where: { id: member2.id },
      data: {
        memberType: "TENANT",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  }

  const adminMember = await prisma.unitMember.findFirst({
    where: { unitId: unit201.id, userId: superAdmin.id },
  });
  if (!adminMember) {
    await prisma.unitMember.create({
      data: {
        unitId: unit201.id,
        userId: superAdmin.id,
        memberType: "OWNER",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  } else {
    await prisma.unitMember.update({
      where: { id: adminMember.id },
      data: {
        memberType: "OWNER",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });
  }
  console.log("✅ Approved Resident & Admin Memberships linked to Units.");

  // 8. Baseline Amenity
  const amenity = await prisma.amenity.upsert({
    where: {
      societyId_name: {
        societyId: society.id,
        name: "Clubhouse Community Banquet Hall",
      },
    },
    update: {
      bookingType: "SLOT_BASED",
      chargeType: "PAID",
      capacity: 150,
      feePerHour: 500.0,
      feePerDay: 4000.0,
      securityDeposit: 2000.0,
      openTime: "08:00",
      closeTime: "23:00",
      rules: JSON.stringify(["Standard society decorum applies.", "No loud music past 10 PM."]),
      isActive: true,
    },
    create: {
      societyId: society.id,
      name: "Clubhouse Community Banquet Hall",
      description: "Air-conditioned banquet and gathering hall for community celebrations.",
      bookingType: "SLOT_BASED",
      chargeType: "PAID",
      capacity: 150,
      feePerHour: 500.0,
      feePerDay: 4000.0,
      securityDeposit: 2000.0,
      openTime: "08:00",
      closeTime: "23:00",
      rules: JSON.stringify(["Standard society decorum applies.", "No loud music past 10 PM."]),
      isActive: true,
    },
  });
  console.log(`✅ Baseline Amenity synchronized: ${amenity.name}`);

  // 9. Baseline Staff Member
  const staff = await prisma.staffMember.upsert({
    where: {
      societyId_phone_staffType: {
        societyId: society.id,
        phone: "+919876500001",
        staffType: "SECURITY_GUARD",
      },
    },
    update: {
      fullName: "Rameshwar Patil",
      staffCode: "STF-001",
      idProofType: "AADHAAR",
      idProofNumber: "XXXX-XXXX-1234",
      policeVerificationStatus: "VERIFIED",
      emergencyContact: "+919876500002",
      rating: 4.8,
      totalReviews: 12,
      isActive: true,
    },
    create: {
      societyId: society.id,
      staffCode: "STF-001",
      fullName: "Rameshwar Patil",
      phone: "+919876500001",
      staffType: "SECURITY_GUARD",
      idProofType: "AADHAAR",
      idProofNumber: "XXXX-XXXX-1234",
      policeVerificationStatus: "VERIFIED",
      emergencyContact: "+919876500002",
      rating: 4.8,
      totalReviews: 12,
      isActive: true,
    },
  });
  console.log(`✅ Baseline Staff Member synchronized: ${staff.fullName} (${staff.staffType})`);

  // 10. Baseline Parking Slot
  const parkingSlot = await prisma.parkingSlot.upsert({
    where: {
      societyId_slotNumber: {
        societyId: society.id,
        slotNumber: "B1-P101",
      },
    },
    update: {
      zone: "BASEMENT_1",
      vehicleType: "FOUR_WHEELER",
      slotType: "DEDICATED_RESIDENT",
      hasEvCharging: true,
      isAllocated: true,
      allocatedUnitId: unit101.id,
      allocationType: "PERMANENT_DEEDED",
      monthlyFee: 0.0,
    },
    create: {
      societyId: society.id,
      slotNumber: "B1-P101",
      zone: "BASEMENT_1",
      vehicleType: "FOUR_WHEELER",
      slotType: "DEDICATED_RESIDENT",
      hasEvCharging: true,
      isAllocated: true,
      allocatedUnitId: unit101.id,
      allocationType: "PERMANENT_DEEDED",
      monthlyFee: 0.0,
      allocatedAt: new Date(),
    },
  });
  console.log(`✅ Baseline Parking Slot synchronized: ${parkingSlot.slotNumber} (Allocated to Unit 101)`);

  // 11. Baseline Statutory Emergency Contact
  let contact = await prisma.emergencyContact.findFirst({
    where: { societyId: society.id, serviceName: "City Trauma Care & Ambulance Service" },
  });
  if (!contact) {
    contact = await prisma.emergencyContact.create({
      data: {
        societyId: society.id,
        serviceName: "City Trauma Care & Ambulance Service",
        category: "AMBULANCE",
        phone: "108",
        alternatePhone: "+917926850000",
        address: "Civil Hospital Road, Ahmedabad",
        contactPerson: "Emergency Dispatch Desk",
        isActive: true,
      },
    });
  }
  console.log(`✅ Baseline Emergency Contact synchronized: ${contact.serviceName} (${contact.phone})`);

  // 12. Baseline Active Maintenance Bill
  let bill = await prisma.maintenanceBill.findUnique({
    where: { receiptNo: "RCP-202610-0001" },
  });
  if (!bill) {
    bill = await prisma.maintenanceBill.create({
      data: {
        societyId: society.id,
        unitId: unit101.id,
        numberOfMonths: 1,
        monthsCovered: ["2026-10"],
        amountPerMonth: 2500.0,
        totalAmount: 2500.0,
        paymentMode: "UPI_INTENT",
        status: "PENDING",
        receiptNo: "RCP-202610-0001",
        paidByUserId: resident1.id,
      },
    });
  }
  console.log(`✅ Baseline Maintenance Bill synchronized: Receipt #${bill.receiptNo} (Total: ₹${bill.totalAmount})`);

  console.log("✨ Master Seeder completed successfully. All records are idempotent and live in PostgreSQL!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
