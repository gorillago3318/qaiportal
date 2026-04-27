import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    currentBank,
    proposedBank,
    currentRate,
    propRate,
    monthlySavings,
    totalInterestSaved,
    accelInterestSaved,
    biweeklyInterestSaved,
    accelTenureMonths,
    biweeklyTenureMonths,
    propTenure,
    noSavings,
    bestIdx,
    curInstalment,
  } = body

  const optionNames = [
    'Option 1 (Lower Monthly Payments)',
    'Option 2 (Pay Off Faster)',
    'Option 3 (Bi-Weekly Turbo)',
  ]
  const bestOption = optionNames[bestIdx as number] ?? optionNames[0]

  let prompt: string

  if (noSavings) {
    prompt = `You are a Malaysian mortgage consultant writing a brief analysis for a client.
The proposed refinancing from ${currentBank} (${currentRate}% p.a.) to ${proposedBank} (${propRate}% p.a.) does not produce net interest savings because the current rate is already competitive.

Write a friendly, professional 180-word analysis (in English) that:
1. Acknowledges the current loan is well-structured
2. Explains Option 1 simply maintains a similar monthly payment at ${proposedBank}
3. Notes Option 2 — keeping the same monthly payment of RM${(curInstalment as number).toFixed(2)} — can clear the loan years earlier due to the lower rate
4. Highlights Option 3's bi-weekly trick: paying every 2 weeks means 26 half-payments per year instead of 24, quietly shaving months off the loan
5. Closes with an encouraging note about small habits compounding over time

Conversational and client-facing. No markdown, no bullet points. Plain paragraphs only.`
  } else {
    const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    prompt = `You are a Malaysian mortgage consultant writing a brief analysis for a client refinancing from ${currentBank} (${currentRate}% p.a.) to ${proposedBank} (${propRate}% p.a.).

Key figures:
- Monthly savings: RM${(monthlySavings as number).toFixed(2)}
- Option 1 (Lower Payments) total interest saved: RM${fmt(totalInterestSaved as number)} over ${propTenure} months
- Option 2 (Pay Faster) total interest saved: RM${fmt(accelInterestSaved as number)}, clears loan in ${accelTenureMonths} months
- Option 3 (Bi-Weekly Turbo) total interest saved: RM${fmt(biweeklyInterestSaved as number)}, clears loan in ${biweeklyTenureMonths} months
- Recommended: ${bestOption}

Write a friendly, professional 180-word explanation for the client that:
1. Opens with the headline savings figure and why this refinancing makes sense
2. Explains clearly why ${bestOption} is recommended and suits most borrowers
3. Briefly notes when someone might choose each of the other two options instead
4. Closes with a clear next-step call-to-action

Conversational and client-facing. No markdown, no bullet points, no headers. Plain paragraphs only.`
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.65,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('DeepSeek error:', errText)
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('AI analysis error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
