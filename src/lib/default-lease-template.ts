type LeaseTemplateInput = {
  landlordName: string;
  landlordAddress: string;
  landlordPhone: string;
  residents: string[];
  occupants: string[];
  propertyAddress: string;
  leaseStart: Date | string;
  leaseEnd?: Date | string | null;
  monthlyRent: number;
  proratedRent?: number | null;
  securityDeposit: number;
  lateFeeAmount?: number | null;
  returnedPaymentFee?: number | null;
  utilitiesPaidByOwner?: string;
};

export type LeaseTemplateSection = {
  title: string;
  body: string[];
  initials?: boolean;
};

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount ?? 0));
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "month-to-month";
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(new Date(date));
}

function list(names: string[]) {
  return names.filter(Boolean).join(", ") || "the resident(s) named in this lease";
}

export function buildDefaultLeaseTemplate(input: LeaseTemplateInput): LeaseTemplateSection[] {
  const residents = list(input.residents);
  const occupants = input.occupants.length ? list(input.occupants) : "the resident(s) listed in this lease only";
  const rent = formatCurrency(input.monthlyRent);
  const proratedRent = formatCurrency(input.proratedRent ?? input.monthlyRent);
  const deposit = formatCurrency(input.securityDeposit);
  const lateFee = formatCurrency(input.lateFeeAmount ?? 75);
  const returnedPaymentFee = formatCurrency(input.returnedPaymentFee ?? 50);
  const ownerUtilities = input.utilitiesPaidByOwner || "cold water only";

  return [
    {
      title: "1. Residency and Financials",
      body: [
        `This Lease Contract is between the undersigned resident(s): ${residents}, and the owner/agent: ${input.landlordName}.`,
        `Resident agrees to rent the property located at ${input.propertyAddress} for use as a private residence only. The terms "you" and "your" refer to all residents listed above. The terms "we," "us," and "our" refer to the owner/agent listed above.`,
        `The apartment will be occupied exclusively by the resident(s) listed above and the following approved occupant(s): ${occupants}. The owner/agent must approve unauthorized occupants living in the premises for longer than 7 consecutive days. Failure to inform the landlord of additional residents and obtain written approval may be a breach of this lease.`,
        `The term of this tenancy begins on ${formatDate(input.leaseStart)} and ends on ${formatDate(input.leaseEnd)}. Thereafter, tenancy may continue month-to-month on the same terms and conditions unless changed or terminated as allowed by law.`,
        `Resident shall pay ${rent} per month for rent. The first month's rent and/or prorated rent amount of ${proratedRent} is due prior to move-in. Rent is due on or before the 1st day of each month with a 5-day grace period.`,
        `Late fee rule: ${lateFee} flat fee. Returned checks or rejected electronic payments are subject to a ${returnedPaymentFee} charge plus any fees charged to the owner/agent by a financial institution and any applicable late fees. These charges and any other account charges are considered additional rent.`,
        `The total security deposit due at execution of this lease is ${deposit}. The owner/agent may apply the security deposit to lawful charges including cleaning, repairs, damages beyond ordinary wear and tear, unpaid rent, late fees, returned payment fees, and other sums due under this lease.`,
        `Owner/agent will pay for the following utilities: ${ownerUtilities}. Resident shall pay for all other utilities, related deposits, charges, fees, and services.`,
        "Owner/agent does not maintain insurance for resident's personal belongings or personal injury. Resident assumes responsibility for personal property and is encouraged to obtain insurance. If required by the owner/agent, resident must maintain personal liability insurance.",
        "Resident will be provided keys and access devices as applicable. Resident is responsible for lost keys, lockouts, unauthorized lock changes, and returning all keys at move-out.",
      ],
      initials: true,
    },
    {
      title: "2. Policies and Procedures",
      body: [
        "Resident, guests, and occupants must comply with all written community rules and policies. Reasonable rule changes may become effective when distributed and applied to all units in the community.",
        "No smoking of any kind is allowed in the apartment or building. Smoking by resident, occupants, or guests may be a breach of this lease.",
        "Resident and all occupants and guests must exercise due care for safety and security, including proper use of smoke detectors, carbon monoxide detectors, locks, window latches, and other safety devices.",
        "Resident must immediately report smoke detector or carbon monoxide detector malfunctions. Resident may not disable safety devices and may be liable for loss, damage, or fines resulting from disabled or damaged safety devices.",
        "Resident, occupants, and guests may not engage in criminal activity in the unit or community. In emergencies, resident should call 911 and then contact the owner/agent.",
        "Parking, if available, is at resident's own risk and subject to owner/agent rules. Unauthorized, inoperable, improperly parked, or illegally parked vehicles may be towed as permitted by law.",
        "Pets and animals are allowed only with written authorization, except as required by applicable law for assistance animals. Unauthorized animals may result in charges, damages, eviction, or other remedies.",
      ],
      initials: true,
    },
    {
      title: "3. Responsibilities",
      body: [
        "Resident accepts the apartment, fixtures, and furnishings as-is except for conditions materially affecting health or safety. Resident shall keep the premises clean, sanitary, and tenantable throughout the tenancy.",
        "Resident may not alter, damage, paint, or remove owner/agent property, fixtures, alarms, smoke detectors, furniture, wiring, screens, locks, or security devices without written consent.",
        "Resident must promptly report damage, leaks, electrical problems, broken locks, missing latches, and any other hazardous conditions. Failure to report problems may make resident responsible for resulting costs.",
        "Resident is responsible for proper use of plumbing systems. Items such as wipes, paper towels, grease, sanitary products, or solid items may not be placed into toilets, drains, or sinks. Clogs caused by resident misuse may be charged to resident.",
        "Owner/agent may enter the premises at reasonable times with proper notice for inspection, repairs, maintenance, pest control, showings, or emergencies.",
        "Resident must provide written notice of intent to vacate as required by the lease and applicable law, including a forwarding address.",
        "At move-out, resident must thoroughly clean the unit and return possession, keys, and access devices. Resident may be liable for unpaid rent, utilities, damages, cleaning, replacement costs, unreturned keys, unauthorized devices, legal fees, and other sums due under the lease.",
        "Security deposit refund and itemized deductions will be handled according to applicable law.",
      ],
      initials: true,
    },
    {
      title: "4. General Clauses",
      body: [
        "Resident will not be released from this lease except as required by law or agreed in writing by owner/agent.",
        "Military personnel may have special termination rights if applicable law provides them. Resident must give written notice and provide required proof.",
        "Replacement residents, subletting, or assignment are allowed only with owner/agent's written consent.",
        "Resident is in default if resident, occupants, or guests violate lease terms, fail to pay rent or other amounts due, violate rules or laws, abandon the apartment, provide false information, engage in prohibited conduct, or otherwise breach this agreement.",
        "Upon default, owner/agent may pursue all remedies allowed by law, including termination, possession, damages, rent, additional rent, fees, and other sums due.",
        "This lease may be amended, waived, or terminated only in writing by authorized representatives. Oral promises or representations are not binding.",
        "To the extent allowed by law, disputes related to this lease may be tried by a judge rather than a jury.",
        "Owner/agent is excused from performance when prevented by events beyond its control, including acts of God, strikes, epidemics, war, terrorism, civil unrest, utility interruption, or similar events.",
      ],
      initials: true,
    },
    {
      title: "5. Sign and Accept",
      body: [
        "This is a legally binding document. By signing electronically, the parties consent to use electronic means to sign this lease and accept the lease agreement and addenda.",
        "Resident will receive access to a copy of the fully signed lease for their records after completion.",
      ],
    },
  ];
}

