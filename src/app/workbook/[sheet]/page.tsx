import WorkbookClient from "./workbook-client";

export default function WorkbookSheetPage({ params }: { params: { sheet: string } }) {
  return <WorkbookClient sheetParam={params.sheet} />;
}
