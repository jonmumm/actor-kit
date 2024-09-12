/**
 * Parses query parameters from a URL string.
 * @param url The URL to parse.
 * @returns A URLSearchParams object containing the parsed query parameters.
 */
export const parseQueryParams = (url: string) => {
    const index = url.indexOf("?");
    const search = index !== -1 ? url.substring(index + 1) : "";
    return new URLSearchParams(search);
  };
  