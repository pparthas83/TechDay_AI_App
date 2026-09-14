/**
 * Con Edison Tech Day - GECX Integration Service
 * 
 * Provides native connectivity to Google Enterprise Customer Experience (GECX) /
 * Dialogflow CX Playbooks & Conversational Agents on Google Cloud.
 */

const { SessionsClient, AgentsClient } = require('@google-cloud/dialogflow-cx');

class GECXService {
  /**
   * @param {Object} options
   * @param {string} [options.projectId] - Google Cloud Project ID
   * @param {string} [options.location] - Regional location (e.g., 'us-central1')
   * @param {string} [options.agentId] - GECX Dialogflow CX Agent UUID
   * @param {string} [options.environmentId] - Optional environment ID (e.g. 'draft')
   */
  constructor(options = {}) {
    this.projectId = options.projectId || process.env.GCP_PROJECT_ID || 'pradeep-demo-1';
    this.location = options.location || process.env.GECX_LOCATION || 'us-central1';
    this.agentId = options.agentId || process.env.GECX_AGENT_ID || '668bd4db-b76d-4f1b-be6b-8e290bb741bd';
    this.environmentId = options.environmentId || process.env.GECX_ENVIRONMENT_ID || null;

    // Build regional API endpoint (e.g., 'us-central1-dialogflow.googleapis.com')
    const apiEndpoint = this.location === 'global'
      ? 'dialogflow.googleapis.com'
      : `${this.location}-dialogflow.googleapis.com`;

    this.clientOptions = {
      apiEndpoint,
      projectId: this.projectId
    };

    this.sessionsClient = new SessionsClient(this.clientOptions);
    this.agentsClient = new AgentsClient(this.clientOptions);

    console.log(`[GECX] Service initialized for Project: ${this.projectId}, Location: ${this.location}, Agent: ${this.agentId}`);
  }

  /**
   * Generates the canonical GECX session resource path.
   * Format: projects/<Project ID>/locations/<Location ID>/agents/<Agent ID>/sessions/<Session ID>
   * Or with environment: projects/<Project ID>/locations/<Location ID>/agents/<Agent ID>/environments/<Environment ID>/sessions/<Session ID>
   * 
   * @param {string} sessionId
   * @returns {string} Canonical session path
   */
  formatSessionPath(sessionId = 'default-stage-session') {
    if (this.environmentId) {
      return this.sessionsClient.projectLocationAgentEnvironmentSessionPath(
        this.projectId,
        this.location,
        this.agentId,
        this.environmentId,
        sessionId
      );
    }
    return this.sessionsClient.projectLocationAgentSessionPath(
      this.projectId,
      this.location,
      this.agentId,
      sessionId
    );
  }

  /**
   * Sends an utterance to GECX and returns the parsed conversational reply and stage triggers.
   * 
   * @param {string} text - User utterance or question
   * @param {string} [sessionId='stage-session-1'] - Active conversation session ID
   * @param {Object} [queryParams={}] - Optional query parameters / session parameters
   * @returns {Promise<{reply: string, rawMessages: Array, stagePayload: Object|null, match: Object}>}
   */
  async detectIntent(text, sessionId = 'stage-session-1', queryParams = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Valid query text is required for GECX intent detection');
    }

    const sessionPath = this.formatSessionPath(sessionId);

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: text.trim()
        },
        languageCode: queryParams.languageCode || 'en'
      },
      queryParams: {
        timeZone: queryParams.timeZone || 'America/New_York',
        parameters: queryParams.parameters || {},
        analyzeQueryTextSentiment: false
      }
    };

    const [response] = await this.sessionsClient.detectIntent(request);
    return this.parseResponse(response);
  }

  /**
   * Parses the GECX detectIntent response object into clean spoken text and stage metadata.
   * 
   * @param {Object} response - Raw Dialogflow CX detectIntent response
   * @returns {{reply: string, rawMessages: Array, stagePayload: Object|null, match: Object}}
   */
  parseResponse(response) {
    const queryResult = response?.queryResult || {};
    const responseMessages = queryResult.responseMessages || [];

    const textFragments = [];
    let stagePayload = null;

    for (const msg of responseMessages) {
      // 1. Spoken text responses
      if (msg.text && Array.isArray(msg.text.text)) {
        for (const t of msg.text.text) {
          if (t && t.trim()) {
            textFragments.push(t.trim());
          }
        }
      }

      // 2. Custom stage control payloads (e.g. trigger lower third, highlight metric)
      if (msg.payload && msg.payload.fields) {
        stagePayload = this._protoStructToJson(msg.payload.fields);
      }
    }

    // Combine text responses, stripping markdown for clean voice synthesis
    const rawReply = textFragments.join(' ');
    const cleanReply = rawReply
      .replace(/[\*\_`#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      reply: cleanReply || 'Thank you. Let us proceed with our panel agenda.',
      rawMessages: responseMessages,
      stagePayload,
      match: {
        matchType: queryResult.match?.matchType || 'UNKNOWN',
        confidence: queryResult.match?.confidence || 0,
        intent: queryResult.match?.intent?.displayName || null
      },
      diagnosticInfo: queryResult.diagnosticInfo || {}
    };
  }

  /**
   * Helper to convert protobuf Struct fields to plain JS object.
   * @private
   */
  _protoStructToJson(fields) {
    const result = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val.stringValue !== undefined) result[key] = val.stringValue;
      else if (val.numberValue !== undefined) result[key] = val.numberValue;
      else if (val.boolValue !== undefined) result[key] = val.boolValue;
      else if (val.structValue && val.structValue.fields) result[key] = this._protoStructToJson(val.structValue.fields);
      else if (val.listValue && val.listValue.values) result[key] = val.listValue.values.map(v => v.stringValue || v.numberValue || v.boolValue);
      else result[key] = val;
    }
    return result;
  }

  /**
   * Fetches metadata for the configured GECX Agent.
   * @returns {Promise<Object>} Agent details (displayName, defaultLanguageCode, timeZone)
   */
  async getAgentInfo() {
    const agentPath = this.agentsClient.agentPath(
      this.projectId,
      this.location,
      this.agentId
    );
    const [agent] = await this.agentsClient.getAgent({ name: agentPath });
    return {
      name: agent.name,
      displayName: agent.displayName,
      defaultLanguageCode: agent.defaultLanguageCode,
      timeZone: agent.timeZone
    };
  }
}

module.exports = GECXService;
