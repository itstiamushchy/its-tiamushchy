export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;
  const { type, body } = req.body;

  if (type === 'tts') {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: body.text },
        voice: { languageCode: 'uk-UA', name: 'uk-UA-Wavenet-A' },
        audioConfig: { audioEncoding: 'MP3' }
      })
    });
    const data = await r.json();
    return res.status(200).json(data);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  res.status(200).json(data);
}
