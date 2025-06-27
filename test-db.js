import { executeQuery } from './db';

export default async function handler(req, res) {
  try {
    const rows = await executeQuery('SELECT * FROM User LIMIT 5');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}