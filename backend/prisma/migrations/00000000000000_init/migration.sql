-- Consolidated production baseline (2026-07-07). Recreates the ENTIRE schema
-- (101 tables, 123 FKs, 225 indexes) on an empty PostgreSQL. Generated from
-- schema.prisma via 'prisma migrate diff --from-empty' and verified applying cleanly
-- on a fresh DB. Supersedes the pre-baseline chain (archived in
-- prisma/migrations-archive-pre-baseline/). See docs/v2-master/113-Production-Deployment.md

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "ownerId" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "subscriptionExpiry" TIMESTAMP(3),
    "enableHajjUmrahModule" BOOLEAN NOT NULL DEFAULT true,
    "enableBdOperationsModule" BOOLEAN NOT NULL DEFAULT false,
    "enabledServiceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledSubcategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "wwwRedirect" TEXT NOT NULL DEFAULT 'www-to-root',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sslStatus" TEXT NOT NULL DEFAULT 'none',
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "verificationToken" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastDnsCheck" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales_agent',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "phone" TEXT,
    "whatsapp" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpiry" TIMESTAMP(3),
    "whatsappVerified" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'signup',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "joinDate" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkIn" TEXT,
    "checkOut" TEXT,
    "notes" TEXT,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT 'annual',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "alternatePhone" TEXT,
    "address" TEXT,
    "dateOfBirth" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" TEXT,
    "nidNumber" TEXT,
    "nationality" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "notes" TEXT,
    "companyName" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'individual',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditLimit" DOUBLE PRECISION,
    "contractRef" TEXT,
    "contractExpiry" TEXT,
    "customFields" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTransaction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'deposit',
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visaType" TEXT NOT NULL,
    "country" TEXT,
    "duration" TEXT,
    "sponsorId" TEXT,
    "visaId" TEXT,
    "occupation" TEXT,
    "buyingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'available',
    "buyerName" TEXT,
    "agentId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCommissionProfile" (
    "agentId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCommissionProfile_pkey" PRIMARY KEY ("agentId")
);

-- CreateTable
CREATE TABLE "BookingAgentCommission" (
    "bookingId" TEXT NOT NULL,
    "agentCommissionAmount" DOUBLE PRECISION,
    "agentCommissionStatus" TEXT DEFAULT 'pending',

    CONSTRAINT "BookingAgentCommission_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "contactPerson" TEXT,
    "address" TEXT,
    "serviceAreas" TEXT,
    "website" TEXT,
    "bankDetails" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingId" TEXT,
    "segmentId" TEXT,
    "description" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "dueDate" TEXT,
    "invoiceRef" TEXT,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "paidBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorNote" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT,
    "destination" TEXT,
    "travelDateFrom" TEXT,
    "travelDateTo" TEXT,
    "travelerCount" INTEGER,
    "budget" DOUBLE PRECISION,
    "score" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "nextFollowUp" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TEXT,
    "assignedTo" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL DEFAULT 'general',
    "source" TEXT NOT NULL DEFAULT 'internal',
    "clientId" TEXT,
    "bookingId" TEXT,
    "assignedTo" TEXT,
    "createdBy" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsitePost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "authorName" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'package',
    "title" TEXT,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT,
    "quotationId" TEXT,
    "packageId" TEXT,
    "serviceType" TEXT,
    "packageTitleSnapshot" TEXT,
    "packageCodeSnapshot" TEXT,
    "destination" TEXT,
    "travelDateFrom" TEXT,
    "travelDateTo" TEXT,
    "travelerCount" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedTo" TEXT,
    "supplierName" TEXT,
    "supplierRef" TEXT,
    "internalNotes" TEXT,
    "serviceDetails" JSONB,
    "opsStatus" TEXT DEFAULT 'pending',
    "followUpDate" TIMESTAMP(3),
    "followUpNote" TEXT,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSegment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "supplierRef" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "details" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BookingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTraveler" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passportNumber" TEXT,
    "passportExpiry" TEXT,
    "nationality" TEXT,
    "dateOfBirth" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,

    CONSTRAINT "BookingTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingChecklistItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,

    CONSTRAINT "BookingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTimelineEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingDocument" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "BookingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "bookingTitle" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "dueDate" TEXT,
    "issuedDate" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "taxRuleId" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInstallment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TEXT,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "transactionRef" TEXT,
    "proofUrl" TEXT,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "receivedBy" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceRefund" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "method" TEXT,
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAuditEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "amount" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "packageId" TEXT,
    "serviceType" TEXT,
    "packageTitleSnapshot" TEXT,
    "packageCodeSnapshot" TEXT,
    "destination" TEXT NOT NULL,
    "travelDateFrom" TEXT,
    "travelDateTo" TEXT,
    "travelerCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "items" JSONB NOT NULL DEFAULT '[]',
    "itinerary" JSONB NOT NULL DEFAULT '[]',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSelling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil" TEXT,
    "notes" TEXT,
    "termsAndConditions" TEXT,
    "createdBy" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationVersion" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "changeNote" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "clientId" TEXT,
    "bookingId" TEXT,
    "vendorId" TEXT,
    "invoiceId" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "date" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "vendorId" TEXT,
    "accountId" TEXT,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'tour_domestic',
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "destination" TEXT,
    "country" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "durationNights" INTEGER NOT NULL DEFAULT 0,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "visaRequired" BOOLEAN,
    "cancellationPolicy" TEXT,
    "seasonalPricing" JSONB,
    "heroImage" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPackageDay" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "overnightLocation" TEXT,

    CONSTRAINT "TravelPackageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPackageInclusion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'included',
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TravelPackageInclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPackagePricing" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "travelerMin" INTEGER NOT NULL DEFAULT 1,
    "travelerMax" INTEGER,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BDT',

    CONSTRAINT "TravelPackagePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPackageMedia" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TravelPackageMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "duration" TEXT NOT NULL DEFAULT '',
    "makkahNights" INTEGER NOT NULL DEFAULT 0,
    "madinahNights" INTEGER NOT NULL DEFAULT 0,
    "makkahHotel" TEXT,
    "madinahHotel" TEXT,
    "hotelClass" TEXT NOT NULL DEFAULT 'economy',
    "flightInfo" TEXT,
    "visaIncluded" BOOLEAN NOT NULL DEFAULT false,
    "transportIncluded" BOOLEAN NOT NULL DEFAULT false,
    "mealsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "ziyaratIncluded" BOOLEAN NOT NULL DEFAULT false,
    "packagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "departureDate" TEXT,
    "returnDate" TEXT,
    "highlights" TEXT,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HajjPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjGroup" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "leaderPhone" TEXT,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT NOT NULL,
    "flightDetails" TEXT,
    "transportSchedule" TEXT,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HajjGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjPilgrim" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "passportNumber" TEXT NOT NULL DEFAULT '',
    "passportExpiry" TEXT,
    "nidNumber" TEXT,
    "nationality" TEXT,
    "mahramName" TEXT,
    "mahramRelation" TEXT,
    "mahramPilgrimId" TEXT,
    "roomType" TEXT,
    "roomNumber" TEXT,
    "roomPartners" TEXT,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "visaStatus" TEXT NOT NULL DEFAULT 'not_started',
    "departureStatus" TEXT NOT NULL DEFAULT 'not_departed',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "medicalNotes" TEXT,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HajjPilgrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjPilgrimPayment" (
    "id" TEXT NOT NULL,
    "pilgrimId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "date" TEXT NOT NULL,
    "note" TEXT,
    "installmentLabel" TEXT,
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HajjPilgrimPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "paymentRequestId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'manual',
    "trxId" TEXT NOT NULL,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerComment" TEXT,
    "processedAt" TIMESTAMP(3),
    "currentPlan" TEXT,
    "requestedPlan" TEXT,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "requestType" TEXT NOT NULL DEFAULT 'activate',
    "paymentMethod" TEXT,
    "expectedAmount" DOUBLE PRECISION,
    "amountSent" DOUBLE PRECISION,
    "senderAccountOrNumber" TEXT,
    "transactionId" TEXT,
    "paymentDate" TEXT,
    "paymentTime" TEXT,
    "proofFileName" TEXT,
    "note" TEXT,
    "adminNote" TEXT,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "activationMode" TEXT NOT NULL DEFAULT 'activate_now',
    "activationDate" TIMESTAMP(3),
    "expiryDateAfterApproval" TIMESTAMP(3),
    "requestSource" TEXT NOT NULL DEFAULT 'tenant',
    "couponCode" TEXT,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originalAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "oldPlan" TEXT,
    "newPlan" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "billingCycle" TEXT,
    "activationDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "actionType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "methodCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "branchName" TEXT,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionAddon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "teamSize" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "tenantSlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    "templateId" TEXT,
    "templateType" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "actorUserId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "houseAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medicalAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providentFund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "effectiveFrom" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidCount" INTEGER NOT NULL DEFAULT 0,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipEntry" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "houseAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medicalAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providentFund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayslipEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pointsPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "redemptionValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "expiryDays" INTEGER NOT NULL DEFAULT 365,
    "silverThreshold" INTEGER NOT NULL DEFAULT 1000,
    "goldThreshold" INTEGER NOT NULL DEFAULT 5000,
    "platinumThreshold" INTEGER NOT NULL DEFAULT 15000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "usedPoints" INTEGER NOT NULL DEFAULT 0,
    "expiredPoints" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'agent',
    "ownerId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralConversion" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referredClientId" TEXT,
    "bookingId" TEXT,
    "commissionEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTour" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT,
    "departureDate" TEXT,
    "returnDate" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTourBooking" (
    "id" TEXT NOT NULL,
    "groupTourId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seatNumber" TEXT,
    "roomNumber" TEXT,
    "roomType" TEXT,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupTourBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBooking" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPayment" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recipient" TEXT NOT NULL,
    "recipientName" TEXT,
    "message" TEXT NOT NULL,
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "notificationId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterReference" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "parentId" TEXT,
    "meta" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaTemplateName" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "applicablePlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'conference',
    "clientId" TEXT,
    "venue" TEXT,
    "city" TEXT,
    "country" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "pax" INTEGER NOT NULL DEFAULT 1,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'inquiry',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceEventItem" (
    "id" TEXT NOT NULL,
    "miceEventId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiceEventItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxFlightBudget" DOUBLE PRECISION,
    "maxHotelPerNight" DOUBLE PRECISION,
    "maxMealPerDay" DOUBLE PRECISION,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approverRole" TEXT NOT NULL DEFAULT 'manager',
    "advanceNoticeDays" INTEGER NOT NULL DEFAULT 3,
    "allowedClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "destination" TEXT,
    "travelDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "purpose" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionNote" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "bookingId" TEXT,
    "applicantName" TEXT NOT NULL,
    "passportNumber" TEXT,
    "nationality" TEXT,
    "visaType" TEXT,
    "destination" TEXT,
    "appliedDate" TIMESTAMP(3),
    "appointmentDate" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'not_applied',
    "referenceNo" TEXT,
    "embassyFee" DOUBLE PRECISION,
    "serviceFee" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT,
    "hotelName" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "starRating" INTEGER,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "totalRooms" INTEGER NOT NULL DEFAULT 0,
    "allocatedRooms" INTEGER NOT NULL DEFAULT 0,
    "ratePerNight" DOUBLE PRECISION,
    "mealPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT,
    "transportType" TEXT NOT NULL DEFAULT 'bus',
    "vehicleModel" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "registrationNo" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "ratePerDay" DOUBLE PRECISION,
    "ratePerTrip" DOUBLE PRECISION,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'full_time',
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "description" TEXT,
    "requirements" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "resumeUrl" TEXT,
    "coverLetter" TEXT,
    "experience" INTEGER,
    "currentSalary" DOUBLE PRECISION,
    "expectedSalary" DOUBLE PRECISION,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "rating" INTEGER,
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT,
    "refundRef" TEXT,
    "pnr" TEXT,
    "ticketNumber" TEXT,
    "clientName" TEXT,
    "airline" TEXT,
    "originalFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "airlineRefund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRefund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agencyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRefundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "refundMethod" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketVoid" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT,
    "voidRef" TEXT,
    "pnr" TEXT,
    "ticketNumber" TEXT,
    "clientName" TEXT,
    "airline" TEXT,
    "ticketDate" TEXT,
    "voidDeadline" TEXT,
    "originalFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voidReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketVoid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketReissue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT,
    "reissueRef" TEXT,
    "pnr" TEXT,
    "ticketNumber" TEXT,
    "clientName" TEXT,
    "airline" TEXT,
    "originalRoute" TEXT,
    "newRoute" TEXT,
    "originalDate" TEXT,
    "newDate" TEXT,
    "originalFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fareDifference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reissueFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agencyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketReissue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BspUpload" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "period" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BspUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BspRecord" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketNumber" TEXT,
    "passengerName" TEXT,
    "airline" TEXT,
    "issuedDate" TEXT,
    "fare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRemit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchedBookingId" TEXT,
    "matchedPnr" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchNote" TEXT,

    CONSTRAINT "BspRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'unknown',
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    "templateType" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformStaff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT,
    "clientName" TEXT,
    "bookingId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "rating" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "subject" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "audienceType" TEXT NOT NULL DEFAULT 'all',
    "audienceValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFamilyMember" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'family',
    "passportNumber" TEXT,
    "dateOfBirth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'credit',
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followUpTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complaintCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customFields" JSONB NOT NULL DEFAULT '[]',
    "automations" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tenantId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "versions" JSONB NOT NULL DEFAULT '[]',
    "history" JSONB NOT NULL DEFAULT '[]',
    "shares" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_domain_key" ON "TenantDomain"("domain");

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "WhatsappOtp_phone_idx" ON "WhatsappOtp"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_tenantId_idx" ON "StaffProfile"("tenantId");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_date_idx" ON "StaffAttendance"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_tenantId_userId_date_key" ON "StaffAttendance"("tenantId", "userId", "date");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_status_idx" ON "StaffLeaveRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Client_tenantId_createdAt_idx" ON "Client"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_tenantId_clientType_idx" ON "Client"("tenantId", "clientType");

-- CreateIndex
CREATE INDEX "AgentTransaction_agentId_idx" ON "AgentTransaction"("agentId");

-- CreateIndex
CREATE INDEX "VisaStock_tenantId_status_idx" ON "VisaStock"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCommissionProfile_userId_key" ON "AgentCommissionProfile"("userId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Lead_tenantId_assignedTo_idx" ON "Lead"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_tenantId_status_idx" ON "SupportTicket"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_tenantId_ticketNumber_key" ON "SupportTicket"("tenantId", "ticketNumber");

-- CreateIndex
CREATE INDEX "WebsitePost_tenantId_status_idx" ON "WebsitePost"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePost_tenantId_slug_key" ON "WebsitePost"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_clientId_idx" ON "Booking"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_createdAt_idx" ON "Booking"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_tenantId_paymentStatus_idx" ON "Booking"("tenantId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_tenantId_agentId_idx" ON "Booking"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_followUpDate_idx" ON "Booking"("tenantId", "followUpDate");

-- CreateIndex
CREATE INDEX "Booking_branchId_idx" ON "Booking"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_clientId_idx" ON "Invoice"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_createdAt_idx" ON "Invoice"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_invoiceId_idx" ON "Payment"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "Account_branchId_idx" ON "Account"("branchId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_createdAt_idx" ON "Transaction"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TravelPackage_tenantId_code_key" ON "TravelPackage"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TravelPackage_tenantId_slug_key" ON "TravelPackage"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_methodCode_key" ON "PaymentMethodConfig"("methodCode");

-- CreateIndex
CREATE INDEX "SubscriptionAddon_tenantId_idx" ON "SubscriptionAddon"("tenantId");

-- CreateIndex
CREATE INDEX "SubscriptionAddon_tenantId_status_idx" ON "SubscriptionAddon"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsTemplate_tenantId_idx" ON "SmsTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "SmsTemplate_type_idx" ON "SmsTemplate"("type");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_idx" ON "SmsLog"("tenantId");

-- CreateIndex
CREATE INDEX "SmsLog_phone_idx" ON "SmsLog"("phone");

-- CreateIndex
CREATE INDEX "SmsLog_status_idx" ON "SmsLog"("status");

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_read_idx" ON "Notification"("tenantId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformNotification_read_idx" ON "PlatformNotification"("read");

-- CreateIndex
CREATE INDEX "PlatformNotification_createdAt_idx" ON "PlatformNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_staffProfileId_key" ON "SalaryStructure"("staffProfileId");

-- CreateIndex
CREATE INDEX "SalaryStructure_tenantId_idx" ON "SalaryStructure"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_status_idx" ON "PayrollRun"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_month_year_key" ON "PayrollRun"("tenantId", "month", "year");

-- CreateIndex
CREATE INDEX "PayslipEntry_tenantId_payrollRunId_idx" ON "PayslipEntry"("tenantId", "payrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRule_tenantId_key" ON "LoyaltyRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_clientId_key" ON "LoyaltyAccount"("clientId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_tenantId_idx" ON "LoyaltyAccount"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_tenantId_accountId_idx" ON "LoyaltyTransaction"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "ReferralCode_tenantId_ownerId_idx" ON "ReferralCode"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_tenantId_code_key" ON "ReferralCode"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ReferralConversion_tenantId_referralCodeId_idx" ON "ReferralConversion"("tenantId", "referralCodeId");

-- CreateIndex
CREATE INDEX "GroupTour_tenantId_status_idx" ON "GroupTour"("tenantId", "status");

-- CreateIndex
CREATE INDEX "GroupTourBooking_groupTourId_idx" ON "GroupTourBooking"("groupTourId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTourBooking_groupTourId_bookingId_key" ON "GroupTourBooking"("groupTourId", "bookingId");

-- CreateIndex
CREATE INDEX "TaxRule_tenantId_isActive_idx" ON "TaxRule"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SmsSettings_tenantId_key" ON "SmsSettings"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationAutomation_tenantId_idx" ON "NotificationAutomation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAutomation_tenantId_eventType_key" ON "NotificationAutomation"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_createdAt_idx" ON "NotificationDelivery"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_eventType_idx" ON "NotificationDelivery"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_idx" ON "NotificationDelivery"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_channel_idx" ON "NotificationDelivery"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "MasterReference_category_isActive_idx" ON "MasterReference"("category", "isActive");

-- CreateIndex
CREATE INDEX "MasterReference_parentId_idx" ON "MasterReference"("parentId");

-- CreateIndex
CREATE INDEX "MasterReference_category_name_idx" ON "MasterReference"("category", "name");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_tenantId_idx" ON "WhatsAppTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_type_idx" ON "WhatsAppTemplate"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCoupon_code_key" ON "SubscriptionCoupon"("code");

-- CreateIndex
CREATE INDEX "MiceEvent_tenantId_status_idx" ON "MiceEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MiceEvent_tenantId_startDate_idx" ON "MiceEvent"("tenantId", "startDate");

-- CreateIndex
CREATE INDEX "MiceEventItem_miceEventId_idx" ON "MiceEventItem"("miceEventId");

-- CreateIndex
CREATE INDEX "TravelPolicy_tenantId_isActive_idx" ON "TravelPolicy"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TravelApprovalRequest_tenantId_status_idx" ON "TravelApprovalRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TravelApprovalRequest_tenantId_requestedBy_idx" ON "TravelApprovalRequest"("tenantId", "requestedBy");

-- CreateIndex
CREATE INDEX "VisaApplication_tenantId_status_idx" ON "VisaApplication"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VisaApplication_tenantId_clientId_idx" ON "VisaApplication"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "VisaApplication_tenantId_bookingId_idx" ON "VisaApplication"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "HotelContract_tenantId_status_idx" ON "HotelContract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "HotelContract_tenantId_country_idx" ON "HotelContract"("tenantId", "country");

-- CreateIndex
CREATE INDEX "TransportContract_tenantId_status_idx" ON "TransportContract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TransportContract_tenantId_transportType_idx" ON "TransportContract"("tenantId", "transportType");

-- CreateIndex
CREATE INDEX "JobPosting_tenantId_status_idx" ON "JobPosting"("tenantId", "status");

-- CreateIndex
CREATE INDEX "JobApplication_tenantId_stage_idx" ON "JobApplication"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "JobApplication_jobPostingId_idx" ON "JobApplication"("jobPostingId");

-- CreateIndex
CREATE INDEX "TicketRefund_tenantId_status_idx" ON "TicketRefund"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TicketRefund_tenantId_createdAt_idx" ON "TicketRefund"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketRefund_tenantId_bookingId_idx" ON "TicketRefund"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "TicketVoid_tenantId_status_idx" ON "TicketVoid"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TicketVoid_tenantId_createdAt_idx" ON "TicketVoid"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketReissue_tenantId_status_idx" ON "TicketReissue"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TicketReissue_tenantId_createdAt_idx" ON "TicketReissue"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BspUpload_tenantId_createdAt_idx" ON "BspUpload"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BspRecord_tenantId_matchStatus_idx" ON "BspRecord"("tenantId", "matchStatus");

-- CreateIndex
CREATE INDEX "BspRecord_uploadId_idx" ON "BspRecord"("uploadId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_tenantId_idx" ON "WhatsAppLog"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_status_idx" ON "WhatsAppLog"("status");

-- CreateIndex
CREATE INDEX "WhatsAppLog_createdAt_idx" ON "WhatsAppLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStaff_email_key" ON "PlatformStaff"("email");

-- CreateIndex
CREATE INDEX "PlatformStaff_status_idx" ON "PlatformStaff"("status");

-- CreateIndex
CREATE INDEX "Complaint_tenantId_status_idx" ON "Complaint"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX "ClientFamilyMember_clientId_idx" ON "ClientFamilyMember"("clientId");

-- CreateIndex
CREATE INDEX "WalletTransaction_clientId_idx" ON "WalletTransaction"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmConfig_tenantId_key" ON "CrmConfig"("tenantId");

-- CreateIndex
CREATE INDEX "SystemFlag_key_idx" ON "SystemFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SystemFlag_key_tenantId_key" ON "SystemFlag"("key", "tenantId");

-- CreateIndex
CREATE INDEX "Document_tenantId_entityType_entityId_idx" ON "Document"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_tenantId_verificationStatus_idx" ON "Document"("tenantId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Document_tenantId_expiryDate_idx" ON "Document"("tenantId", "expiryDate");

-- AddForeignKey
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTransaction" ADD CONSTRAINT "AgentTransaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTransaction" ADD CONSTRAINT "AgentTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaStock" ADD CONSTRAINT "VisaStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAgentCommission" ADD CONSTRAINT "BookingAgentCommission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillPayment" ADD CONSTRAINT "VendorBillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorNote" ADD CONSTRAINT "VendorNote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePost" ADD CONSTRAINT "WebsitePost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTraveler" ADD CONSTRAINT "BookingTraveler_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingChecklistItem" ADD CONSTRAINT "BookingChecklistItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTimelineEvent" ADD CONSTRAINT "BookingTimelineEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDocument" ADD CONSTRAINT "BookingDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPackage" ADD CONSTRAINT "TravelPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPackageDay" ADD CONSTRAINT "TravelPackageDay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPackageInclusion" ADD CONSTRAINT "TravelPackageInclusion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPackagePricing" ADD CONSTRAINT "TravelPackagePricing_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPackageMedia" ADD CONSTRAINT "TravelPackageMedia_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjPackage" ADD CONSTRAINT "HajjPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjGroup" ADD CONSTRAINT "HajjGroup_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "HajjPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjGroup" ADD CONSTRAINT "HajjGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjPilgrim" ADD CONSTRAINT "HajjPilgrim_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "HajjPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjPilgrim" ADD CONSTRAINT "HajjPilgrim_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "HajjGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjPilgrim" ADD CONSTRAINT "HajjPilgrim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjPilgrimPayment" ADD CONSTRAINT "HajjPilgrimPayment_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "HajjPilgrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipEntry" ADD CONSTRAINT "PayslipEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipEntry" ADD CONSTRAINT "PayslipEntry_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipEntry" ADD CONSTRAINT "PayslipEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRule" ADD CONSTRAINT "LoyaltyRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralConversion" ADD CONSTRAINT "ReferralConversion_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralConversion" ADD CONSTRAINT "ReferralConversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTour" ADD CONSTRAINT "GroupTour_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTourBooking" ADD CONSTRAINT "GroupTourBooking_groupTourId_fkey" FOREIGN KEY ("groupTourId") REFERENCES "GroupTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTourBooking" ADD CONSTRAINT "GroupTourBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsSettings" ADD CONSTRAINT "SmsSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterReference" ADD CONSTRAINT "MasterReference_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MasterReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceEvent" ADD CONSTRAINT "MiceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceEvent" ADD CONSTRAINT "MiceEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceEventItem" ADD CONSTRAINT "MiceEventItem_miceEventId_fkey" FOREIGN KEY ("miceEventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPolicy" ADD CONSTRAINT "TravelPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelApprovalRequest" ADD CONSTRAINT "TravelApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelApprovalRequest" ADD CONSTRAINT "TravelApprovalRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "TravelPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelContract" ADD CONSTRAINT "HotelContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportContract" ADD CONSTRAINT "TransportContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRefund" ADD CONSTRAINT "TicketRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRefund" ADD CONSTRAINT "TicketRefund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketVoid" ADD CONSTRAINT "TicketVoid_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketVoid" ADD CONSTRAINT "TicketVoid_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketReissue" ADD CONSTRAINT "TicketReissue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketReissue" ADD CONSTRAINT "TicketReissue_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BspUpload" ADD CONSTRAINT "BspUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BspRecord" ADD CONSTRAINT "BspRecord_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "BspUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFamilyMember" ADD CONSTRAINT "ClientFamilyMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmConfig" ADD CONSTRAINT "CrmConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

