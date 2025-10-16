// Simple ping endpoint to keep the main function warm
export default function handler(req, res) {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
}

