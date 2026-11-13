import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`
  if (digits.startsWith('1') && digits.length === 9) return `254${digits}`
  return ''
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('Payment service is not configured.')
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

async function getUser(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization) throw new Error('Sign in before making a payment.')

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('Payment service is not configured.')

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error('Your session has expired. Sign in again.')
  return user
}

async function getAuthorizedChama(client: ReturnType<typeof getServiceClient>, chamaId: string, user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const { data: chama, error } = await client
    .from('chamas')
    .select('id, owner_id, members')
    .eq('id', chamaId)
    .single()

  if (error || !chama) throw new Error('Chama not found.')
  const members = Array.isArray(chama.members) ? chama.members : []
  const userEmail = (user.email || '').trim().toLowerCase()
  const userPhone = normalizePhone(String(user.user_metadata?.phone_number || ''))
  const member = members.find((item: Record<string, unknown>) => {
    const memberEmail = String(item.email || '').trim().toLowerCase()
    const memberPhone = normalizePhone(String(item.phone_number || ''))
    return item.user_id === user.id ||
      Boolean(userEmail && memberEmail === userEmail) ||
      Boolean(userPhone && memberPhone === userPhone)
  })

  if (chama.owner_id !== user.id && !member) {
    throw new Error('Only chama members can make payments.')
  }
  return { chama, member }
}

async function createPayment(request: Request, body: Record<string, unknown>) {
  const user = await getUser(request)
  const client = getServiceClient()
  const chamaId = String(body.chamaId || '')
  const memberName = String(body.memberName || '').trim()
  const purpose = String(body.purpose || '').trim()
  const amount = Number(body.amount)
  const method = String(body.method || '')

  if (!chamaId || !memberName || memberName.length > 120 || !purpose || purpose.length > 120 || !Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) {
    throw new Error('Enter a valid chama, member, purpose, and positive whole-KES amount.')
  }
  if (method !== 'M-Pesa' && method !== 'Bank transfer') {
    throw new Error('Choose M-Pesa or bank transfer.')
  }

  const { chama, member } = await getAuthorizedChama(client, chamaId, user)
  const isOwner = chama.owner_id === user.id
  const selectedMember = (Array.isArray(chama.members) ? chama.members : [])
    .find((item: Record<string, unknown>) => item.name === memberName)
  if (!selectedMember || (!isOwner && selectedMember !== member)) {
    throw new Error('Choose your own member profile to make this payment.')
  }

  const payerPhone = normalizePhone(String(body.phoneNumber || user.user_metadata?.phone_number || ''))
  if (method === 'M-Pesa' && !payerPhone) {
    throw new Error('Enter a valid Kenyan mobile number for the M-Pesa prompt.')
  }
  const bankReference = String(body.bankReference || '').trim()
  if (method === 'Bank transfer' && (!bankReference || bankReference.length > 80)) {
    throw new Error('Enter the bank transfer reference before submitting.')
  }

  const { data: payment, error: insertError } = await client
    .from('payments')
    .insert({
      chama_id: chamaId,
      user_id: user.id,
      amount,
      member_name: selectedMember.name,
      initials: selectedMember.initials || 'CH',
      member_tone: selectedMember.tone || 'sage',
      purpose,
      method,
      payer_phone_number: payerPhone,
      bank_reference: method === 'Bank transfer' ? bankReference : null,
    })
    .select('id')
    .single()

  if (insertError || !payment) throw new Error('We could not start this payment. Try again.')
  if (method === 'Bank transfer') return { paymentId: payment.id, status: 'pending' }

  const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
  const shortcode = Deno.env.get('DARAJA_SHORTCODE')
  const passkey = Deno.env.get('DARAJA_PASSKEY')
  const callbackUrl = Deno.env.get('DARAJA_CALLBACK_URL')
  const callbackToken = Deno.env.get('DARAJA_CALLBACK_TOKEN')
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl || !callbackToken) {
    await client.from('payments').update({ status: 'failed' }).eq('id', payment.id)
    throw new Error('M-Pesa is not configured. Add the Daraja settings to Supabase secrets.')
  }

  try {
    const environment = Deno.env.get('DARAJA_ENV') === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke'
    const host = `https://${environment}`
    const credentials = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    const tokenBody = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenBody.access_token) throw new Error('Daraja authentication failed.')

    const timestamp = formatTimestamp(new Date())
    const password = btoa(`${shortcode}${passkey}${timestamp}`)
    const callback = new URL(callbackUrl)
    callback.searchParams.set('token', callbackToken)
    const stkResponse = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: Deno.env.get('DARAJA_TRANSACTION_TYPE') || 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: payerPhone,
        PartyB: shortcode,
        PhoneNumber: payerPhone,
        CallBackURL: callback.toString(),
        AccountReference: `CH${chamaId.replaceAll('-', '').slice(0, 8)}`,
        TransactionDesc: purpose.slice(0, 13),
      }),
    })
    const stkBody = await stkResponse.json()
    if (!stkResponse.ok || !stkBody.CheckoutRequestID) {
      throw new Error(stkBody.errorMessage || 'Daraja could not initiate the payment.')
    }

    const { error: updateError } = await client
      .from('payments')
      .update({
        merchant_request_id: stkBody.MerchantRequestID,
        checkout_request_id: stkBody.CheckoutRequestID,
      })
      .eq('id', payment.id)
    if (updateError) throw new Error('Unable to save the M-Pesa request.')
    return { paymentId: payment.id, status: 'pending' }
  } catch (error) {
    await client.from('payments').update({ status: 'failed' }).eq('id', payment.id)
    throw error
  }
}

async function verifyBankPayment(request: Request, body: Record<string, unknown>) {
  const user = await getUser(request)
  const client = getServiceClient()
  const paymentId = String(body.paymentId || '')
  const { data: payment, error } = await client
    .from('payments')
    .select('id, chama_id, method, status, bank_reference')
    .eq('id', paymentId)
    .single()
  if (error || !payment || payment.method !== 'Bank transfer' || payment.status !== 'pending') {
    throw new Error('This pending bank transfer could not be found.')
  }

  const { data: chama, error: chamaError } = await client
    .from('chamas')
    .select('owner_id')
    .eq('id', payment.chama_id)
    .single()
  if (chamaError || chama?.owner_id !== user.id) {
    throw new Error('Only the chama chairman can verify bank transfers.')
  }

  const { data: confirmed, error: confirmError } = await client.rpc('confirm_chama_payment', {
    p_payment_id: payment.id,
    p_receipt: payment.bank_reference,
  })
  if (confirmError) throw new Error('We could not confirm this transfer.')
  if (!confirmed) throw new Error('This payment has already been processed.')
  return { status: 'paid' }
}

async function handleDarajaCallback(request: Request, body: Record<string, unknown>) {
  const callbackToken = Deno.env.get('DARAJA_CALLBACK_TOKEN')
  if (!callbackToken || new URL(request.url).searchParams.get('token') !== callbackToken) {
    return respond({ error: 'Unauthorized callback.' }, 401)
  }

  const stkCallback = (body.Body as Record<string, unknown> | undefined)?.stkCallback as Record<string, unknown> | undefined
  const checkoutRequestId = String(stkCallback?.CheckoutRequestID || '')
  if (!checkoutRequestId) return respond({ ResultCode: 0, ResultDesc: 'Accepted' })

  const client = getServiceClient()
  const { data: payment } = await client
    .from('payments')
    .select('id, amount, payer_phone_number, status')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle()
  if (!payment || payment.status !== 'pending') return respond({ ResultCode: 0, ResultDesc: 'Accepted' })

  if (Number(stkCallback?.ResultCode) !== 0) {
    await client.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending')
    return respond({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const metadata = (stkCallback?.CallbackMetadata as { Item?: Array<{ Name?: string; Value?: unknown }> } | undefined)?.Item || []
  const itemValue = (name: string) => metadata.find((item) => item.Name === name)?.Value
  const amount = Number(itemValue('Amount'))
  const receipt = String(itemValue('MpesaReceiptNumber') || '')
  const phone = normalizePhone(String(itemValue('PhoneNumber') || ''))
  if (amount !== payment.amount || phone !== payment.payer_phone_number || !receipt) {
    await client.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending')
    return respond({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const { error } = await client.rpc('confirm_chama_payment', {
    p_payment_id: payment.id,
    p_receipt: receipt,
  })
  if (error) return respond({ ResultCode: 1, ResultDesc: 'Payment confirmation failed' }, 500)
  return respond({ ResultCode: 0, ResultDesc: 'Accepted' })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  try {
    const body = await request.json() as Record<string, unknown>
    if (body.Body && new URL(request.url).searchParams.has('token')) {
      return await handleDarajaCallback(request, body)
    }
    if (body.action === 'verify-bank') return respond(await verifyBankPayment(request, body))
    if (body.action === 'create') return respond(await createPayment(request, body))
    return respond({ error: 'Unsupported payment action.' }, 400)
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'Payment could not be processed.' }, 400)
  }
})
