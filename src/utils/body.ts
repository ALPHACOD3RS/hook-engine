export async function normalizeRequestBody(req: any) : Promise<Buffer> {
    if (req.body instanceof Buffer) return req.body;

    if (typeof req.body === "string") {
      return Buffer.from(req.body, "utf8");
    }
  
    if (typeof req.body === "object" && req.body !== null) {
      return Buffer.from(JSON.stringify(req.body), "utf8");
    }
  
    throw new Error("Unsupported request body format");
}