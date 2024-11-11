import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

const client = new Retell({
  apiKey: "key_aa76e2b1dca3cbaac06373d34297",
});

export async function POST(request: Request) {
  try {

    const { systemPrompt } = await request.json();

    console.log('Client methods:', Object.keys(client));
    
    // Create Retell LLM
    const llmResponse = await client.llm.create({
      general_prompt: systemPrompt
    });
    console.log('LLM created:', llmResponse);

    // Create Agent with the Retell LLM
    const agentResponse = await client.agent.create({
      response_engine: { 
        type: 'retell-llm',
        llm_id: llmResponse.llm_id
      },
      voice_id: '11labs-Adrian'
    });

    console.log('Agent created:', agentResponse);

    // Create Web Call with Agent ID
    const webCall = await client.call.createWebCall({
      agent_id: agentResponse.agent_id,
    });

    console.log('WebCall AccessToken:', webCall.access_token);

    return NextResponse.json({ 
      llm: llmResponse,
      agent: agentResponse,
      webCall: webCall,
      wsUrl: `wss://api.retellai.com/websocket?call_id=${webCall.call_id}`,    
      accessToken: webCall.access_token
    });
  } catch (error) {
    console.error('Error details:', error);
    return NextResponse.json(
      { error: 'Failed to create session', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    
    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }

    const callResponse = await client.call.retrieve(callId);
    return NextResponse.json(callResponse);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve transcript' },
      { status: 500 }
    );
  }
}