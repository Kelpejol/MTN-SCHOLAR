import { csvResponse, toCsv } from "@/lib/csv";
import { guardAdminApi } from "@/lib/http";
import { REQUIRED_COLUMNS } from "@/lib/scholar-import";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;
  return csvResponse("scholars-template.csv", toCsv([...REQUIRED_COLUMNS], []));
}
