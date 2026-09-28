/**
 * Con Edison Tech Day - Gemini 3.8 Live with Live Avatar Service
 * 
 * Bridges client WebRTC/WebSocket streams with Gemini 3.8 Multimodal Live API,
 * binding real-time Con Edison data services and deterministic calculation engines.
 */

const {
  fetchNWSWeatherAlerts,
  fetchNYISOGridFuelMix,
  fetchLiveOutages,
  calculateCleanHeatSizing
} = require('./live_data_service');

const WATT_SYSTEM_INSTRUCTION = `You are Watt, the AI Keynote Moderator for Con Edison's Tech Day: AI in Action (held on October 7, 2026).
You are a warm, knowledgeable, executive-level moderator representing Consolidated Edison of New York.
You speak clearly, concisely, and with high technical precision.

Your core mission during the keynote is to moderate and explain Con Edison's 4 enterprise AI pillars:
1. Customer Operations: AMI bill deflection, smart meter anomaly detection, and conversational billing agents.
2. Grid Resilience: Real-time outage telemetry, storm path situational awareness, and feeder-level automation.
3. Clean Heat & Decarbonization: Heat pump sizing, NYS Clean Heat rebates, and Local Law 97 compliance calculations.
   Note: All Clean Heat figures you provide are preliminary estimates subject to an onsite ACCA Manual J load calculation.
4. Field Operations & Safety: Telematics idling reduction, manhole acoustic sensing, and smart work authorization.

When asked about current weather, NYISO grid fuel mix, Con Edison outage metrics, or Clean Heat sizing, you MUST call the appropriate live tool to provide authoritative real-time numbers.

Keep spoken responses conversational, engaging, and under 3 to 4 sentences unless asked for an in-depth breakdown.`;

// Tool Declarations in Gemini Live Function Calling schema
const GEMINI_LIVE_TOOLS = [
  {
    name: 'fetch_nyiso_fuel_mix',
    description: 'Fetches real-time generation fuel mix and zero-carbon clean energy percentage from the New York Independent System Operator (NYISO) grid.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'fetch_weather_alerts',
    description: 'Fetches active National Weather Service (NWS) severe weather warnings, watches, and advisories for the New York City metropolitan area.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'calculate_clean_heat_rebate',
    description: 'Calculates heat pump heating ton sizing, Con Edison Clean Heat rebates, annual fuel savings, and Local Law 97 penalty avoidance. Figures are preliminary estimates subject to onsite Manual J calculation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        squareFootage: {
          type: 'NUMBER',
          description: 'Conditioned building area in square feet (e.g. 3500).'
        },
        borough: {
          type: 'STRING',
          description: 'NYC Borough or Westchester (e.g. Brooklyn, Manhattan, Queens, Bronx, Staten Island, Westchester).'
        },
        buildingType: {
          type: 'STRING',
          description: 'Type of building: residential, multifamily, or commercial.'
        },
        isDac: {
          type: 'BOOLEAN',
          description: 'Whether property is in a NYSERDA Disadvantaged Community (DAC) eligible for 50% incentive bonus.'
        }
      },
      required: ['squareFootage']
    }
  },
  {
    name: 'fetch_coned_outages',
    description: 'Fetches live operational outage telemetry from Con Edison outage management system, including total active outages, customers affected, and system-wide reliability percentage.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];

// Keynote Agenda Topics & Structured Starter Prompts
const KEYNOTE_AGENDA_TOPICS = [
  {
    id: 0,
    key: 'intro',
    title: 'Keynote Intro',
    description: 'Welcome and overview of AI in Action at Con Edison Tech Day',
    prompt: 'Welcome everyone to Con Edison Tech Day: AI in Action. Introduce yourself as Watt, Con Edison\'s AI keynote moderator powered by Gemini 3.8 Live Avatar, and briefly outline today\'s four enterprise themes: Customer Operations, Grid Resilience, Clean Heat, and Field Safety.'
  },
  {
    id: 1,
    key: 'customer_ops',
    title: 'Customer Operations',
    description: 'AMI smart meter billing agent and high-bill deflection',
    prompt: 'Explain Con Edison\'s Customer Operations AI transformation. How do AMI interval data and generative billing agents resolve high-bill inquiries and prevent bill shock?'
  },
  {
    id: 2,
    key: 'grid_resilience',
    title: 'Grid Resilience',
    description: 'Real-time outage detection, storm impact and NYISO fuel mix',
    prompt: 'Detail how Con Edison utilizes AI for Grid Modernization and Resilience, integrating live NYISO generation telemetry and predictive storm staging.'
  },
  {
    id: 3,
    key: 'clean_heat',
    title: 'Clean Heat & LL97',
    description: 'Electrification, heat pump rebates, and building emissions compliance',
    prompt: 'Explain Con Edison\'s Clean Heat and decarbonization initiatives, including heat pump rebates, Local Law 97 emissions compliance, and the importance of ACCA Manual J load calculations.'
  },
  {
    id: 4,
    key: 'field_safety',
    title: 'Field Safety & Fleet',
    description: 'Telematics idling reduction and acoustic manhole monitoring',
    prompt: 'Highlight Con Edison\'s Field Safety and Operational AI, including vehicle idling telematics, fuel reduction, and acoustic manhole safety monitoring.'
  },
  {
    id: 5,
    key: 'qa',
    title: 'Summary & Live Q&A',
    description: 'Wrap up and open audience Q&A with Watt',
    prompt: 'Summarize today\'s keynote takeaways and invite the audience to ask you any question about Con Edison\'s AI innovations and live grid operations.'
  }
];

/**
 * Executes a Gemini Live tool call against the authoritative Con Edison services
 */
async function executeGeminiTool(functionName, args = {}) {
  console.log(`[Gemini Live Service] Executing tool: ${functionName}`, args);

  switch (functionName) {
    case 'fetch_nyiso_fuel_mix': {
      const data = await fetchNYISOGridFuelMix();
      return {
        summary: data.summary,
        totalMw: data.totalLoadMW,
        zeroCarbonPercent: data.zeroCarbonPct !== undefined ? data.zeroCarbonPct : data.cleanPercentage,
        timestamp: data.timestamp
      };
    }

    case 'fetch_weather_alerts': {
      const data = await fetchNWSWeatherAlerts();
      return {
        summary: data.headline || data.summary,
        alertCount: data.activeAlerts || 0,
        headline: data.headline
      };
    }

    case 'calculate_clean_heat_rebate': {
      const sqft = args.squareFootage || 3500;
      const borough = args.borough || 'Brooklyn';
      const buildingType = args.buildingType || 'residential';
      const isDac = Boolean(args.isDac);

      const result = calculateCleanHeatSizing({
        sqft,
        borough,
        buildingType,
        dacEligible: isDac
      });

      const tons = result.recommendedTons || 5.8;
      const totalIncentive = result.financials?.totalIncentives || result.prescriptiveRebate || 12000;
      const savings = result.financials?.estimatedAnnualFuelSavings || result.estimatedAnnualFuelSavings || 2610;

      return {
        ...result,
        heatPumpTons: tons,
        totalIncentive: totalIncentive,
        estimatedAnnualSavings: savings,
        status: 'PRELIMINARY_ESTIMATE',
        verificationRequirement: 'Actual rebate amounts and heat pump sizing require an onsite ACCA Manual J load calculation.'
      };
    }

    case 'fetch_coned_outages': {
      const data = await fetchLiveOutages();
      return {
        summary: data.summary,
        totalOutages: data.activeOutages || data.totalActiveOutages || 0,
        customersAffected: data.customersAffected || 0,
        systemReliability: data.reliabilityRate || `${data.systemReliabilityPct}%`,
        timestamp: data.timestamp
      };
    }

    default:
      throw new Error(`Unknown function name: ${functionName}`);
  }
}

module.exports = {
  WATT_SYSTEM_INSTRUCTION,
  GEMINI_LIVE_TOOLS,
  KEYNOTE_AGENDA_TOPICS,
  executeGeminiTool
};
