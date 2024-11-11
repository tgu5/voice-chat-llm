import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

const retellClient = new Retell({
  apiKey: "key_aa76e2b1dca3cbaac06373d34297",
});

console.log('Available methods:', Object.keys(retellClient));
console.log('Voice methods:', Object.keys(retellClient.voice || {}));

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    const sessionId = formData.get('sessionId') as string;

    // Use the voice.sendAudio method
    await retellClient.voice.sendAudio(sessionId, audioBlob);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending audio:', error);
    return NextResponse.json(
      { error: 'Failed to send audio', details: error.message },
      { status: 500 }
    );
  }
}