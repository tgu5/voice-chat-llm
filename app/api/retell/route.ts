import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

const client = new Retell({
  apiKey: "key_aa76e2b1dca3cbaac06373d34297",
});

export async function POST(request: Request) {
  try {

    const { systemPrompt } = await request.json();

    // Log available methods
    console.log('Client methods:', Object.keys(client));
    
    // Step 1: Create Retell LLM
    const llmResponse = await client.llm.create({
      general_prompt: systemPrompt
    });
    console.log('LLM created:', llmResponse);

    // Step 2: Create Agent with the Retell LLM
    const agentResponse = await client.agent.create({
      response_engine: { 
        type: 'retell-llm',
        llm_id: llmResponse.llm_id
      },
      voice_id: '11labs-Adrian'
    });

    console.log('Agent created:', agentResponse);


    // const llmResponse = await client.llm.retrieve('llm_1fa3fde195c60c39b01638e29978');
    // const agentResponse = await client.agent.retrieve('agent_63c0cf3878a0241746cb29d66e');

    // Step 3: Create Web Call with Agent ID
    const webCall = await client.call.createWebCall({
      agent_id: agentResponse.agent_id,
    });

    console.log('WebCall AccessToken:', webCall.access_token);

    return NextResponse.json({ 
      llm: llmResponse,
      agent: agentResponse,
      webCall: webCall,
      // Either webCall.ws_url or construct the URL based on their documentation
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
// import { NextResponse } from 'next/server';
// import Retell from 'retell-sdk';

// const client = new Retell({
//   apiKey: "key_aa76e2b1dca3cbaac06373d34297",
// });

// export async function POST(request: Request) {
//   try {
//     const { systemPrompt } = await request.json();

//     // Let's first log what methods are available
//     console.log('Client methods:', Object.keys(client));
//     console.log('Voice methods:', Object.keys(client.voice || {}));
    
//     // Try to get available voices first
//     const voiceResponse = await client.voice.retrieve('11labs-Adrian');
//     console.log('Voice response:', voiceResponse);

//     return NextResponse.json({ 
//       voice: voiceResponse
//     });
//   } catch (error) {
//     console.error('Available methods on error:', Object.keys(client));
//     console.error('Error details:', error);
//     return NextResponse.json(
//       { error: 'Failed to create session', details: error.message },
//       { status: 500 }
//     );
//   }
// }