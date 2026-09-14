import { NextResponse } from "next/server";
import { analyze } from "@/lib/engine/analyze";
import { generateReport } from "@/lib/engine/report";
import type {
  AnalysisInput,
  BalanceSheetInput,
  IncomeStatementInput,
} from "@/lib/engine/types";

// The Anthropic key is read server-side, inside lib/engine/report.ts, from
// process.env.ANTHROPIC_API_KEY. It is never sent to, or read from, the
// client — this route only ever forwards the client's financial figures in
// and a JSON result back out.

interface AnalyzeRequestBody {
  input: AnalysisInput;
  companyName?: string;
}

const REQUIRED_INCOME_FIELDS: (keyof IncomeStatementInput)[] = [
  "revenue",
  "cogs",
  "operatingExpenses",
];

const REQUIRED_BALANCE_FIELDS: (keyof BalanceSheetInput)[] = [
  "cash",
  "accountsReceivable",
  "inventory",
  "ppe",
  "accountsPayable",
  "equity",
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function firstInvalidNumericField<T extends object>(
  obj: T,
  fields: readonly (keyof T)[]
): string | null {
  for (const field of fields) {
    if (!isFiniteNumber(obj[field])) return String(field);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalyzeRequestBody>;

    if (!body.input || typeof body.input !== "object") {
      return NextResponse.json(
        { error: 'Request body must include an "input" object.' },
        { status: 400 }
      );
    }
    const input: AnalysisInput = body.input;

    if (!input.income || typeof input.income !== "object") {
      return NextResponse.json(
        { error: 'Missing "input.income" (income statement).' },
        { status: 400 }
      );
    }
    if (!input.balance || typeof input.balance !== "object") {
      return NextResponse.json(
        { error: 'Missing "input.balance" (balance sheet).' },
        { status: 400 }
      );
    }

    const badIncomeField = firstInvalidNumericField(
      input.income,
      REQUIRED_INCOME_FIELDS
    );
    if (badIncomeField) {
      return NextResponse.json(
        { error: `Income field "${badIncomeField}" must be a number.` },
        { status: 400 }
      );
    }

    const badBalanceField = firstInvalidNumericField(
      input.balance,
      REQUIRED_BALANCE_FIELDS
    );
    if (badBalanceField) {
      return NextResponse.json(
        {
          error: `Balance sheet field "${badBalanceField}" must be a number.`,
        },
        { status: 400 }
      );
    }

    const result = analyze(input);
    const report = await generateReport(result, {
      companyName: body.companyName,
    });

    return NextResponse.json({ result, report });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error while analyzing financials.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
