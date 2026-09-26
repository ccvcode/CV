import { config } from "@/lib/core/config";

/** Identitatea operatorului (GDPR art. 13 alin. 1 lit. a); vine din MEDIAN_COMPANY*. */
export function Operator() {
  if (!config.company)
    return (
      <p className="border-l-[3px] border-accent pl-3 text-[15px]">
        <b>Datele operatorului</b> (denumire, sediu, cod fiscal) se completează înainte de lansarea publică, prin variabilele
        MEDIAN_COMPANY, MEDIAN_COMPANY_ADDRESS și MEDIAN_COMPANY_ID. Până atunci, ne poți scrie la{" "}
        <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>.
      </p>
    );
  return (
    <p>
      Operatorul datelor este <b>{config.company}</b>
      {config.companyId && <>, cod fiscal {config.companyId}</>}
      {config.companyAddress && <>, cu sediul în {config.companyAddress}</>}. Contact:{" "}
      <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>.
    </p>
  );
}
