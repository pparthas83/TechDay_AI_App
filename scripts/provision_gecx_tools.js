/**
 * Provisions native OpenAPI 3.0 tools on Dialogflow CX agent and attaches them to the Playbook.
 */
const { execSync } = require('child_process');

const PROJECT_ID = 'pradeep-demo-1';
const LOCATION = 'us-central1';
const AGENT_ID = '668bd4db-b76d-4f1b-be6b-8e290bb741bd';
const PLAYBOOK_ID = '2b294c58-7cfb-4aa6-bc72-3a591ce18841';
const KNOWLEDGE_TOOL_ID = '6f2af2f7-e297-4804-93aa-5a49c3e01ab3';
const BASE_URL = `https://${LOCATION}-dialogflow.googleapis.com/v3/projects/${PROJECT_ID}/locations/${LOCATION}/agents/${AGENT_ID}`;

function getAuthToken() {
  try {
    return execSync('CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud auth application-default print-access-token', { encoding: 'utf-8' }).trim();
  } catch (e) {
    return execSync('CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud auth print-access-token', { encoding: 'utf-8' }).trim().split('\n').pop();
  }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': PROJECT_ID
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

const TOOLS_CONFIG = [
  {
    displayName: 'nws-weather-tool',
    description: 'Fetches real-time National Weather Service severe weather alerts and storm advisories for New York City.',
    openApiSpec: {
      textSchema: `openapi: 3.0.0
info:
  title: NWS Weather Alerts
  version: 1.0.0
  description: Fetches current severe weather alerts and National Weather Service advisories for New York City.
servers:
  - url: https://coned-tech-day-832497031659.us-central1.run.app
paths:
  /api/live/weather:
    get:
      summary: Get live NYC weather alerts
      description: Returns active storm, wind, snow, and severe weather advisories for NYC.
      operationId: getLiveWeatherAlerts
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  activeAlertsCount:
                    type: integer
                  headline:
                    type: string
                  description:
                    type: string
                  source:
                    type: string`
    }
  },
  {
    displayName: 'nyiso-grid-tool',
    description: 'Fetches real-time NYISO electric grid fuel mix, generation load, and zero-carbon clean energy percentage for New York.',
    openApiSpec: {
      textSchema: `openapi: 3.0.0
info:
  title: NYISO Real-Time Grid Fuel Mix Telemetry
  version: 1.0.0
  description: Fetches real-time electric generation fuel mix and zero-carbon clean energy percentage for the New York grid from NYISO.
servers:
  - url: https://coned-tech-day-832497031659.us-central1.run.app
paths:
  /api/live/grid:
    get:
      summary: Get live NYISO grid fuel mix
      description: Returns real-time MW generation by fuel type and clean energy percentage.
      operationId: getLiveGridFuelMix
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  totalLoadMW:
                    type: number
                  renewablesTotalMW:
                    type: number
                  cleanPercentage:
                    type: number
                  summary:
                    type: string`
    }
  },
  {
    displayName: 'clean-heat-calc-tool',
    description: 'Calculates heat pump sizing tonnage, Con Edison clean heat rebates, and Local Law 97 penalty avoidance for residential and commercial buildings.',
    openApiSpec: {
      textSchema: `openapi: 3.0.0
info:
  title: Clean Heat and Local Law 97 Sizing & Rebate Calculator
  version: 1.0.0
  description: Calculates heat pump sizing tonnage, Con Edison clean heat rebates, and Local Law 97 penalty avoidance.
servers:
  - url: https://coned-tech-day-832497031659.us-central1.run.app
paths:
  /api/tools/clean-heat-calc:
    post:
      summary: Calculate clean heat sizing and rebate
      description: Computes heat pump tonnage, rebate USD, and carbon savings for a given square footage and borough.
      operationId: calculateCleanHeat
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                sqft:
                  type: number
                  description: Square footage of the property (e.g. 3500)
                borough:
                  type: string
                  description: Borough in NYC or Westchester (e.g. Manhattan, Brooklyn, Queens, Bronx, Staten Island, Westchester)
                dacEligible:
                  type: boolean
                  description: Whether property is in a Disadvantaged Community (DAC)
      responses:
        '200':
          description: Successful calculation response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    description: Calculation status (e.g. PRELIMINARY_ESTIMATE)
                  recommendedTons:
                    type: number
                  prescriptiveRebate:
                    type: number
                  estimatedAnnualFuelSavings:
                    type: number
                  ll97PenaltyAvoidedAnnual:
                    type: number
                  verificationRequirement:
                    type: string
                    description: Mandatory engineering and utility verification requirement
                  disclaimer:
                    type: string
                    description: Professional utility engineering disclaimer regarding onsite Manual J requirements
                  summaryText:
                    type: string`
    }
  },
  {
    displayName: 'outages-tool',
    description: 'Fetches real-time Con Edison outage statistics, customer restoration numbers, and 99.99% system reliability metrics.',
    openApiSpec: {
      textSchema: `openapi: 3.0.0
info:
  title: Con Edison Live Outage and Reliability Telemetry
  version: 1.0.0
  description: Fetches current system reliability metrics and active outage statistics across Con Edison service territories.
servers:
  - url: https://coned-tech-day-832497031659.us-central1.run.app
paths:
  /api/live/outages:
    get:
      summary: Get live outage statistics
      description: Returns active customers affected, total customers served, and 99.99% system reliability metric.
      operationId: getLiveOutageStatus
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  activeOutagesCount:
                    type: integer
                  customersAffected:
                    type: integer
                  customersServed:
                    type: integer
                  reliabilityRate:
                    type: string
                  summary:
                    type: string`
    }
  }
];

async function main() {
  console.log('=== 1. Checking Existing Tools on GECX Agent ===');
  const existingToolsRes = await apiRequest('/tools');
  const existingTools = existingToolsRes.tools || [];
  console.log(`Found ${existingTools.length} existing tools.`);

  const toolResourceMap = {};
  for (const t of existingTools) {
    toolResourceMap[t.displayName] = t.name;
    console.log(` - ${t.displayName}: ${t.name}`);
  }

  // Ensure knowledge tool is mapped
  toolResourceMap['coned-knowledge-tool'] = `projects/${PROJECT_ID}/locations/${LOCATION}/agents/${AGENT_ID}/tools/${KNOWLEDGE_TOOL_ID}`;

  console.log('\n=== 2. Provisioning / Updating OpenAPI Tools ===');
  for (const toolDef of TOOLS_CONFIG) {
    if (toolResourceMap[toolDef.displayName]) {
      const existingName = toolResourceMap[toolDef.displayName];
      console.log(`Updating existing tool: ${toolDef.displayName} (${existingName})...`);
      const updated = await apiRequest(`/tools/${existingName.split('/').pop()}`, 'PATCH', {
        displayName: toolDef.displayName,
        description: toolDef.description,
        openApiSpec: toolDef.openApiSpec
      });
      console.log(` ✓ Updated ${toolDef.displayName}`);
    } else {
      console.log(`Creating new tool: ${toolDef.displayName}...`);
      const created = await apiRequest('/tools', 'POST', toolDef);
      toolResourceMap[toolDef.displayName] = created.name;
      console.log(` ✓ Created ${toolDef.displayName}: ${created.name}`);
    }
  }

  console.log('\n=== 3. Updating Playbook Instructions & Referenced Tools ===');
  const referencedTools = [
    toolResourceMap['coned-knowledge-tool'],
    toolResourceMap['nws-weather-tool'],
    toolResourceMap['nyiso-grid-tool'],
    toolResourceMap['clean-heat-calc-tool'],
    toolResourceMap['outages-tool']
  ];

  const playbookSteps = [
    { text: "You are Watt, the AI moderator for the Con Edison Tech Day: AI in Action keynote panel." },
    { text: "Speak in a professional, youthful, cheerful, and articulate tone. Never use slang." },
    { text: "Introduce and moderate the five featured use cases: 1) Customer Billing Agent, 2) Fleet Vehicle Idling Reduction, 3) Subsurface Manhole Acoustic Safety, 4) Weather Modeling Grid Resilience, 5) Clean Heat and Customer Energy Solutions." },
    { text: "When asked about live weather alerts, storms, wind, rain, or National Weather Service forecasts, use ${TOOL:nws-weather-tool} to retrieve real-time alerts and state current conditions." },
    { text: "When asked about the electric grid, NYISO fuel mix, clean energy percentage, solar, wind, or generation, use ${TOOL:nyiso-grid-tool} to fetch live grid telemetry and quote the clean power figures." },
    { text: "When asked to calculate heat pump sizing, rebates, incentives, savings, or Local Law 97 penalty avoidance, use ${TOOL:clean-heat-calc-tool} to compute exact numbers for the property, and naturally clarify that these are preliminary screening estimates subject to a certified contractor's onsite ACCA Manual J load calculation and final utility approval." },
    { text: "When asked about power outages, blackouts, restoration, or system reliability, use ${TOOL:outages-tool} to provide verified Con Edison operations metrics." },
    { text: "When asked if you have access to the National Weather Service, NYISO grid telemetry, the clean heat calculator, or real-time tools, confirm enthusiastically that you do and use the appropriate tool to present current data." },
    { text: "If the user asks specific questions regarding Con Edison programs, clean heat rebates, heat pumps, electric vehicles, SmartCharge NY, billing assistance, tariffs, storm hardening, manhole safety, or company operations, use ${TOOL:coned-knowledge-tool} to retrieve verified Con Edison data." },
    { text: "Synthesize all answers clearly and concisely within 1 to 2 spoken sentences (under 35 words) so that stage pacing remains dynamic." }
  ];

  const updatedPlaybook = await apiRequest(`/playbooks/${PLAYBOOK_ID}`, 'PATCH', {
    displayName: "Watt - Tech Day Moderator",
    goal: "Moderate the Con Edison AI in Action panel showcasing the 5 key business use cases as Watt, answering stage and audience questions with verified Con Edison operational data and live enterprise tools.",
    referencedTools,
    instruction: {
      steps: playbookSteps
    }
  });

  console.log(`\n✓ Playbook successfully updated! Referenced tools count: ${updatedPlaybook.referencedTools?.length || 0}`);
  console.log('Tools bound:');
  for (const t of updatedPlaybook.referencedTools || []) {
    console.log(` - ${t}`);
  }
}

main().catch(err => {
  console.error('\nProvisioning error:', err);
  process.exit(1);
});
