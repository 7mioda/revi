const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const res = await fetch(`${API_URL}/profiles/jobs/${jobId}`)
  const body = await res.json() as unknown
  return Response.json(body, { status: res.status })
}
