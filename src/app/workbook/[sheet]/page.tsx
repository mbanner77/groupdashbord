import WorkbookClient from "./workbook-client";

export default async function WorkbookSheetPage({ params }: { params: Promise<{ sheet: string }> }) {
  const { sheet } = await params;
  return <WorkbookClient sheetParam={sheet} />;
}
