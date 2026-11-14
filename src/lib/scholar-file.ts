/** Shared by the upload dialog and the server parser so unsupported files get the same guidance. */
export function getScholarFileTypeError(fileName: string): string | null {
  if (/\.xls$/i.test(fileName)) return "Old .xls files aren't supported. Please save the file as .xlsx or .csv.";
  if (!/\.(csv|xlsx)$/i.test(fileName)) return "Unsupported file type. Upload a .csv or .xlsx file.";
  return null;
}
