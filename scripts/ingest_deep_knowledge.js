/**
 * Con Edison Tech Day: Deep Knowledge & Hybrid Corpus Generator
 * 
 * Generates 19 technical documents covering all 5 use cases and public coned.com pages,
 * creates a JSONL index, uploads them to Cloud Storage, and incrementally indexes them into Vertex AI Search.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BASE_DIR = path.join(__dirname, '..', 'coned_knowledge_docs');

const DOCUMENTS = [
  // ==========================================
  // USE CASE 1: CUSTOMER OPERATIONS & BILLING
  // ==========================================
  {
    folder: 'usecase_1_billing',
    file: 'coned_billing_rag_architecture_blueprint.html',
    title: 'Con Edison Generative Billing Agent: Technical RAG Architecture Blueprint',
    content: `
      <h2>1. Retrieval-Augmented Generation (RAG) Architecture for Customer Operations</h2>
      <p>The Con Edison Generative Billing Agent utilizes a hybrid RAG framework deployed on Google Cloud Vertex AI to explain billing variations to residential and commercial customers. The architecture separates deterministic financial calculations from natural-language generation.</p>
      <p><strong>Core Pipeline Components:</strong></p>
      <ul>
        <li><strong>Smart Meter Telemetry Ingestion:</strong> Ingests 15-minute interval electric data (kWh) and hourly gas interval data (ccf) from over 5.2 million deployed AMI smart meters.</li>
        <li><strong>Deterministic Variance Engine:</strong> Python-based mathematical verification layer that computes the exact variance delta between current and prior billing cycles, decomposing variance into weather impact, rate component changes, and calendar day differences before LLM invocation.</li>
        <li><strong>Semantic Knowledge Retrieval:</strong> Vector search over Con Edison tariff schedules (PSC No. 10), fuel adjustment clauses, and customer eligibility rules.</li>
        <li><strong>LLM Generation & Safety Rails:</strong> Gemini model generates personalized, conversational explanations. A strict output validation layer ensures zero numerical hallucinations: every dollar amount, percentage, and date must exactly match the output of the Deterministic Variance Engine.</li>
      </ul>
      <h2>2. Degree-Day Variance Decomposition Formula</h2>
      <p>The billing agent applies weather-normalized sensitivity factors based on standard utility degree-day metrics:</p>
      <ul>
        <li><strong>Cooling Degree Days (CDD):</strong> Max(0, Mean Daily Temp - 65°F). Used to quantify summer air conditioning load spikes.</li>
        <li><strong>Heating Degree Days (HDD):</strong> Max(0, 65°F - Mean Daily Temp). Used to quantify winter space heating variances.</li>
        <li><strong>Formula:</strong> Expected Weather Variance ($) = (Current CDD/HDD - Prior CDD/HDD) × Baseline Customer Thermal Elasticity Factor (kWh/degree-day) × Marginal Volumetric Tariff Rate ($/kWh).</li>
      </ul>
    `
  },
  {
    folder: 'usecase_1_billing',
    file: 'coned_tariff_schedule_psc10_sc1_residential.html',
    title: 'Con Edison Electric Tariff Schedule: PSC No. 10 - Service Classification No. 1 (Residential)',
    content: `
      <h2>Service Classification No. 1 (SC-1) Residential & Religious Service</h2>
      <p>Con Edison's electricity tariff filed under New York Public Service Commission (NYPSC) Schedule P.S.C. No. 10 - Electricity governs retail electric delivery to residential consumers.</p>
      <h3>Rate Options:</h3>
      <ul>
        <li><strong>Rate I (Standard Residential Flat Rate):</strong> Includes a fixed monthly customer charge (approx. $21.50 per month) plus a flat volumetric delivery rate per kWh regardless of the hour consumed. Ideal for standard residential usage profiles without significant discretionary flexible load.</li>
        <li><strong>Rate III (Voluntary Time-of-Use / TOU):</strong> Variable delivery rates by time of day:
          <ul>
            <li><strong>Peak Hours (2:00 PM – 6:00 PM weekdays, June through September):</strong> Higher delivery rates reflecting summer grid strain.</li>
            <li><strong>Off-Peak Hours (All other hours, weekends, and holidays):</strong> Significantly discounted delivery rates (over 40% reduction compared to standard Rate I).</li>
            <li><strong>Super Off-Peak (Overnight 12:00 AM – 8:00 AM for EV owners):</strong> Lowest volumetric delivery rate, optimized for EV charging and electric heat pump space heating.</li>
          </ul>
        </li>
      </ul>
      <h3>Supply Charges vs. Delivery Charges:</h3>
      <p>Customers can purchase electricity supply from Con Edison (Market Supply Charge, passing through wholesale NYISO day-ahead prices without markup) or from an Energy Services Company (ESCO). Delivery charges are strictly regulated by the NYPSC and maintain the physical grid.</p>
    `
  },
  {
    folder: 'usecase_1_billing',
    file: 'coned_ami_interval_data_dictionary.html',
    title: 'Con Edison Advanced Metering Infrastructure (AMI): Data Dictionary & Interval Telemetry',
    content: `
      <h2>Smart Meter (AMI) Telemetry Specification</h2>
      <p>Con Edison's AMI deployment consists of solid-state electronic meters communicating across a multi-hop 900 MHz IPv6 wireless mesh network connecting to cellular collectors and Con Edison Head-End Systems.</p>
      <h3>Interval Data Attributes:</h3>
      <ul>
        <li><strong>Interval Granularity:</strong> 15-minute intervals for electric consumption (kWh) and reactive power (kVARh); 60-minute intervals for gas consumption (ccf).</li>
        <li><strong>Voltage Profiling:</strong> Continuous root-mean-square (RMS) voltage monitoring reporting over-voltage (>126V) and under-voltage (<114V) events to maintain ANSI C84.1 Range A service limits.</li>
        <li><strong>Outage & Restoration Signals:</strong> Last-gasp transmission on power loss (dying gasp) sending immediate grid fault notification; power restoration verification pinging upon secondary re-energization.</li>
        <li><strong>Customer Portal Integration:</strong> Granular data available to customers within 24 hours through the Con Edison My Account portal and Green Button Connect API.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_1_billing',
    file: 'coned_eap_low_income_assistance_policy.html',
    title: 'Con Edison Energy Affordability Program (EAP) & Payment Assistance Policy',
    content: `
      <h2>Energy Affordability Program (EAP) & Financial Assistance</h2>
      <p>Con Edison provides targeted bill discounts to income-eligible residential customers under the Energy Affordability Program (EAP) pursuant to NYPSC orders.</p>
      <h3>Discount Tiers & Eligibility:</h3>
      <ul>
        <li><strong>Automatic Enrollment:</strong> Customers receiving benefits under HEAP (Home Energy Assistance Program), SNAP (Supplemental Nutrition Assistance Program), SSI, Medicaid, TANF, or Veterans Pension automatically qualify.</li>
        <li><strong>Monthly Bill Credits:</strong> Tiered discounts range from $20.00 up to $155.00 per month depending on heating fuel type (electric non-heating, electric heating, or natural gas heating).</li>
      </ul>
      <h3>Deferred Payment Agreements (DPA):</h3>
      <p>Customers with past-due balances may establish a DPA with terms spanning up to 24 months, zero down payment for eligible low-income accounts, and no interest charges as long as monthly installment and current charges are maintained.</p>
    `
  },

  // ==========================================
  // USE CASE 2: FLEET VEHICLE IDLING REDUCTION
  // ==========================================
  {
    folder: 'usecase_2_idling',
    file: 'coned_fleet_telematics_ai_whitepaper.html',
    title: 'Con Edison Fleet Vehicle Idling Reduction AI: Engineering Architecture',
    content: `
      <h2>Fleet Telematics & Computer Vision AI Architecture</h2>
      <p>Con Edison operates over 4,500 fleet vehicles, including heavy-duty aerial bucket trucks, underground maintenance vans, and emergency response units across the five boroughs and Westchester County.</p>
      <h3>Telematics Data Ingestion:</h3>
      <ul>
        <li><strong>SAE J1939 CAN Bus Ingestion:</strong> Continuous 1 Hz telemetry streaming engine parameters: Engine Speed (RPM), Fuel Rate (L/hr), Engine Coolant Temperature, Parking Brake Status, and Vehicle Ground Speed.</li>
        <li><strong>Power Take-Off (PTO) State Detection:</strong> Auxiliary sensors monitor hydraulic pump engagement for bucket boom elevation and underground cable pulling winches.</li>
        <li><strong>Edge Machine Learning Classification:</strong> Onboard IoT gateways run a lightweight inference model to categorize engine run state:
          <ul>
            <li><strong>Transit:</strong> Speed > 0 mph.</li>
            <li><strong>Legitimate Work Mode:</strong> Speed = 0 mph, Parking Brake Set, PTO Active (hydraulic equipment operating).</li>
            <li><strong>Regulatory Idle:</strong> Speed = 0 mph, PTO Inactive, Engine Run Time > 3 minutes.</li>
          </ul>
        </li>
      </ul>
    `
  },
  {
    folder: 'usecase_2_idling',
    file: 'coned_fleet_nyc_anti_idling_regulatory_specs.html',
    title: 'Con Edison Fleet Operations: NYC Anti-Idling Regulatory Compliance & Law § 24-163',
    content: `
      <h2>NYC Administrative Code § 24-163: Anti-Idling Laws & Utility Exemptions</h2>
      <p>New York City strictly enforces environmental laws to reduce localized particulate matter and nitrogen oxides ($NO_x$) across urban neighborhoods.</p>
      <h3>Statutory Rules:</h3>
      <ul>
        <li><strong>3-Minute Limit:</strong> Idling an engine for more than three minutes while parked or standing is illegal across New York City.</li>
        <li><strong>1-Minute School Zone Rule:</strong> Adjacent to public or private schools, the idling limit is strictly 1 minute.</li>
        <li><strong>Utility Operational Exemptions:</strong> The law permits engine operation when necessary to power auxiliary equipment, such as bucket booms, emergency scene lighting, underground vacuum excavation, or dewatering pumps.</li>
        <li><strong>Extreme Weather Cabin Temperature Exceptions:</strong> Per OSHA and collective bargaining safety standards, limited engine operation is permitted during extreme sub-freezing ambient temperatures (< 25°F) or severe heat (> 90°F) to protect field technician health.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_2_idling',
    file: 'coned_fleet_emissions_and_fuel_metrics.html',
    title: 'Con Edison Fleet Decarbonization: Fuel Savings, ROI & Carbon Impact Metrics',
    content: `
      <h2>Fleet Emissions Reductions & Financial ROI</h2>
      <p>The AI Idling Reduction system optimizes fleet operations to directly advance New York's clean air objectives.</p>
      <h3>Quantitative Impact:</h3>
      <ul>
        <li><strong>Heavy-Duty Diesel Idle Consumption:</strong> A Class 7/8 utility bucket truck consumes approximately 0.8 to 1.1 gallons of ultra-low sulfur diesel per idle hour.</li>
        <li><strong>EPA Emissions Factor:</strong> Every gallon of diesel conserved eliminates 22.38 pounds (10.15 kg) of direct carbon dioxide ($CO_2$) emissions, alongside reductions in particulate matter ($PM_{2.5}$) and $NO_x$.</li>
        <li><strong>Annual Enterprise Savings:</strong> Eliminating an average of 45 minutes of discretionary idling per vehicle per day saves over 420,000 gallons of fuel annually, preventing over 4,700 metric tons of greenhouse gas emissions and delivering over $2.2 million in direct operating cost savings.</li>
        <li><strong>Hybrid Battery Bucket Trucks:</strong> Transitioning to electric PTO (e-PTO) lithium-ion battery packs enables bucket operation for up to 8 hours with the main diesel engine completely shut off.</li>
      </ul>
    `
  },

  // ==========================================
  // USE CASE 3: SUBSURFACE MANHOLE ACOUSTIC SAFETY
  // ==========================================
  {
    folder: 'usecase_3_manholes',
    file: 'coned_subsurface_acoustic_ai_specification.html',
    title: 'Con Edison Subsurface Safety: Edge AI Acoustic Anomaly Detection in Manholes',
    content: `
      <h2>Underground Vault Acoustic & Thermal Edge AI</h2>
      <p>Con Edison operates the world's most intricate underground electric distribution network, comprising more than 270,000 manholes and service boxes across New York City.</p>
      <h3>Acoustic Sensor Physics & Signal Processing:</h3>
      <ul>
        <li><strong>Piezoelectric Acoustic Transducers:</strong> Harsh-environment, IP68 hermetically sealed sensors mounted within underground vaults sample vibrations and acoustic pressure waves at 48 kHz.</li>
        <li><strong>Fast Fourier Transform (FFT) Spectrogram Analysis:</strong> Edge microcontrollers convert raw audio into frequency spectrograms, monitoring:
          <ul>
            <li><strong>120 Hz Baseline Hum:</strong> Standard AC current induction frequency.</li>
            <li><strong>Harmonic Distortion (360 Hz, 600 Hz):</strong> Signals transformer saturation and thermal stress.</li>
            <li><strong>High-Frequency Crackle & Arcing (2 kHz – 15 kHz):</strong> Acoustic precursors of micro-arcing and dielectric breakdown within paper-insulated lead-covered (PILC) and ethylene propylene rubber (EPR) cable splices hours or days before smoking or event progression.</li>
          </ul>
        </li>
      </ul>
    `
  },
  {
    folder: 'usecase_3_manholes',
    file: 'coned_engineering_spec_eo10140_vault_safety.html',
    title: 'Con Edison Engineering Specification EO-10140: Underground Secondary Network Safety',
    content: `
      <h2>Engineering Specification EO-10140: Vault Maintenance & Vented Cover Deployment</h2>
      <p>Con Edison's technical standard for underground secondary systems establishes mandatory inspection, atmospheric testing, and infrastructure protection protocols.</p>
      <h3>Mandatory Safety Criteria:</h3>
      <ul>
        <li><strong>Multi-Gas Atmospheric Telemetry:</strong> In-vault environmental nodes monitor Carbon Monoxide ($CO$), Methane ($CH_4$), Oxygen ($O_2$), and Hydrogen Sulfide ($H_2S$). Any $CO$ reading exceeding 35 ppm or combustible gas exceeding 10% LEL triggers automated alert dispatch.</li>
        <li><strong>Vented Manhole Covers:</strong> Deployment of specialized ribbed vented covers designed to safely dissipate gas pressure, release latent heat, and prevent cover dislodgement during underground thermal events.</li>
        <li><strong>Thermal Imaging:</strong> Infrared scanning protocols verifying that cable splice temperature delta does not exceed 15°C above ambient vault baseline.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_3_manholes',
    file: 'coned_stray_voltage_testing_and_mitigation.html',
    title: 'Con Edison Contact Voltage: Stray Voltage Detection & Street Safety Programs',
    content: `
      <h2>Contact (Stray) Voltage Detection & Mitigation</h2>
      <p>Con Edison leads the industry in proactive contact voltage testing to ensure pedestrian and pet safety on city sidewalks and roadways.</p>
      <h3>Testing & Protection Standards:</h3>
      <ul>
        <li><strong>Mobile Detection Fleet:</strong> Specialized electric detection vehicles equipped with sensitive electric field sensors scan tens of thousands of street miles annually, detecting voltage differentials as low as 1 volt AC.</li>
        <li><strong>Action Threshold:</strong> Any accessible surface structure (street lights, service box covers, traffic signals) exhibiting potential greater than 1.0 volt AC is immediately guarded, de-energized, and repaired under emergency priority.</li>
        <li><strong>Secondary Shunt & Insulation:</strong> Installation of secondary network isolation limiters, waterproof heat-shrink splice sleeves, and polymer composite manhole covers in high-density pedestrian corridors.</li>
      </ul>
    `
  },

  // ==========================================
  // USE CASE 4: SEVERE WEATHER & GRID RESILIENCE
  // ==========================================
  {
    folder: 'usecase_4_weather',
    file: 'coned_weather_predictive_damage_model_whitepaper.html',
    title: 'Con Edison Meteorology & Grid Resilience: Predictive Storm Damage Modeling',
    content: `
      <h2>Hyper-Local Weather Modeling & Asset Fragility Machine Learning</h2>
      <p>Con Edison's Electric Operations integrates high-resolution meteorological forecasting with electric distribution topology to forecast storm damage 72 hours before weather impact.</p>
      <h3>Meteorological Data Assimilation:</h3>
      <ul>
        <li><strong>NOAA HRRR (High-Resolution Rapid Refresh):</strong> 3-kilometer atmospheric model grids updated hourly, tracking localized wind gust shear, wet snow density, and freezing rain accumulation.</li>
        <li><strong>Hydrodynamic Storm Surge Simulation:</strong> Integration of SLOSH (Sea, Lake, and Overland Surges from Hurricanes) and ADCIRC coastal hydrodynamic models predicting seawater inundation levels along coastal substations in lower Manhattan, Brooklyn, and Queens.</li>
        <li><strong>LiDAR Tree Canopy Fragility Curves:</strong> Aerial LiDAR mapping quantifying vegetative proximity and canopy overhang along 13.2 kV and 27 kV overhead distribution feeders in Westchester, Staten Island, and Queens.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_4_weather',
    file: 'coned_storm_emergency_response_plan.html',
    title: 'Con Edison Storm Emergency Response Plan (ERP) & Mutual Aid Prepositioning',
    content: `
      <h2>Storm Emergency Response Plan & Resource Mobilization</h2>
      <p>Con Edison's ERP defines structured incident command levels (Condition Normal to Serious Incident Condition 1) to mobilize personnel and external utility mutual aid.</p>
      <h3>Key Operational Protocols:</h3>
      <ul>
        <li><strong>Prepositioning Matrix:</strong> Staging mutual aid line crews, tree-trimming contractors, and bucket trucks at strategic regional staging areas (e.g., Westchester County Center, Citifield) 48 hours prior to storm landfall based on model-predicted outage counts.</li>
        <li><strong>Restoration Tiers:</strong>
          <ul>
            <li><strong>Tier 1: Critical Infrastructure:</strong> Hospitals, water treatment facilities, emergency dispatch (911), transit pumping stations.</li>
            <li><strong>Tier 2: Transmission & Primary Substations:</strong> Backbone high-voltage transmission lines restoring bulk network feeding.</li>
            <li><strong>Tier 3: Distribution Feeders:</strong> Overhead three-phase main lines restoring large neighborhood clusters.</li>
            <li><strong>Tier 4: Secondary & Individual Service Drops:</strong> Local lateral fuses, pole-top transformers, and individual home customer lines.</li>
          </ul>
        </li>
      </ul>
    `
  },
  {
    folder: 'usecase_4_weather',
    file: 'coned_flisr_distribution_automation_manual.html',
    title: 'Con Edison Grid Automation: Fault Location, Isolation, and Service Restoration (FLISR)',
    content: `
      <h2>Distribution Automation: FLISR Self-Healing Grid Systems</h2>
      <p>Con Edison's overhead and underground circuits utilize automated smart switches to minimize the footprint and duration of customer interruptions.</p>
      <h3>System Mechanics:</h3>
      <ul>
        <li><strong>Automated Detection:</strong> Microprocessor-based feeder reclosers and line sensors detect fault current magnitude and phase.</li>
        <li><strong>Automatic Isolation:</strong> Intelligent electronic devices (IEDs) open isolating sectionalizers around the faulted section in under 45 seconds without requiring manual control room intervention.</li>
        <li><strong>Service Restoration:</strong> Tie switches close automatically to back-feed unfaulted sections from adjacent feeders, restoring service to up to 80% of affected customers within 60 seconds.</li>
      </ul>
    `
  },

  // ==========================================
  // USE CASE 5: CLEAN HEAT & DECARBONIZATION
  // ==========================================
  {
    folder: 'usecase_5_clean_heat',
    file: 'coned_ny_clean_heat_technical_program_manual.html',
    title: 'Con Edison Clean Heat Program: Technical Resource Manual & Incentive Schedules',
    content: `
      <h2>NY Clean Heat Program: Technical Specifications & Rebate Structures</h2>
      <p>The NY Clean Heat program provides market-transforming incentives to replace fossil-fuel heating (oil, gas, propane) with cold-climate electric heat pumps across single-family, multifamily, and commercial properties.</p>
      <h3>Equipment Standards:</h3>
      <ul>
        <li><strong>Cold-Climate Air-Source Heat Pumps (ccASHP):</strong> Must be listed on the Northeast Energy Efficiency Partnerships (NEEP) Qualified Product List. Must achieve a minimum Coefficient of Performance (COP) ≥ 1.75 at 5°F (-15°C) and maintain at least 70% of rated heating capacity at 5°F.</li>
        <li><strong>Ground-Source Geothermal Heat Pumps (GSHP):</strong> Closed-loop geothermal systems with ENERGY STAR certification, offering maximum seasonal efficiency (COP > 3.5).</li>
      </ul>
      <h3>Prescriptive Incentive Amounts:</h3>
      <ul>
        <li><strong>ccASHP Full-Load Heating:</strong> Up to $2,000 per ton of rated heating capacity for residential properties; custom incentives up to $1,000 per MMBtu displaced for commercial facilities.</li>
        <li><strong>Disadvantaged Communities (DAC) Bonus:</strong> Properties located in state-designated DAC zones qualify for an additional 50% incentive bonus, covering up to 100% of conversion costs for income-qualified families.</li>
        <li><strong>Heat Pump Water Heaters (HPWH):</strong> Prescriptive rebate of $1,000 per qualifying unitary heat pump water heater.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_5_clean_heat',
    file: 'coned_nyc_local_law_97_compliance_and_penalties.html',
    title: 'NYC Local Law 97: Building Carbon Emissions Limits & Penalty Avoidance Guide',
    content: `
      <h2>NYC Local Law 97: Decarbonization Mandates & Electrification Compliance</h2>
      <p>Local Law 97 of 2019 requires most buildings over 25,000 gross square feet to meet strict greenhouse gas emissions intensity caps beginning in 2024, with significantly more stringent limits starting in 2030.</p>
      <h3>Carbon Limits & Financial Penalties:</h3>
      <ul>
        <li><strong>Statutory Penalty Rate:</strong> Building owners are assessed an annual financial penalty of <strong>$268 per metric ton of CO2 equivalent ($tCO_2e$)</strong> emitted in excess of the building's allocated emissions limit.</li>
        <li><strong>Emissions Factors by Fuel:</strong>
          <ul>
            <li>No. 2 Fuel Oil: 0.07421 tCO2e / MMBtu</li>
            <li>No. 4 Fuel Oil: 0.07529 tCO2e / MMBtu</li>
            <li>Natural Gas: 0.05311 tCO2e / MMBtu</li>
            <li>Grid Electricity: Declines over time as NY state grid integrates offshore wind, hydro, and solar under the CLCPA (Clean Energy Standard).</li>
          </ul>
        </li>
        <li><strong>Clean Heat Compliance Benefit:</strong> Converting from fuel oil or natural gas to high-efficiency heat pumps eliminates onsite combustion emissions, directly mitigating or zeroing out annual Local Law 97 penalties.</li>
      </ul>
    `
  },
  {
    folder: 'usecase_5_clean_heat',
    file: 'coned_clean_heat_tariffs_and_smartcharge_ev.html',
    title: 'Con Edison Clean Energy Tariffs: SC-1 Rate III & SmartCharge New York EV Rewards',
    content: `
      <h2>Electrification Tariffs: Clean Heat TOU & SmartCharge EV Rewards</h2>
      <p>Con Edison aligns customer economics with grid capacity through specialized tariffs and smart charging incentives.</p>
      <h3>Clean Heat Time-of-Use Rate (SC-1 Rate III):</h3>
      <ul>
        <li><strong>Winter Heating Advantage:</strong> Clean heat customers avoid high delivery tiers with lower off-peak volumetric delivery rates during winter months, significantly reducing operating costs compared to standard residential flat rates.</li>
        <li><strong>Electrical Service Upgrades:</strong> Guidance for converting from 100-amp to 200-amp service entrance panels to support whole-home heat pumps and Level 2 EV charging simultaneously.</li>
      </ul>
      <h3>SmartCharge New York EV Rewards:</h3>
      <ul>
        <li><strong>Off-Peak Rewards:</strong> EV drivers earn $0.10 per kWh for charging during off-peak hours (12:00 AM to 8:00 AM) throughout the Con Edison service area.</li>
        <li><strong>Summer Avoidance Bonus:</strong> Additional financial rewards for avoiding charging during critical summer peak windows (2:00 PM to 6:00 PM on weekdays from June to September).</li>
      </ul>
    `
  },

  // ==========================================
  // PUBLIC CONED.COM WEBSITE GROUNDING
  // ==========================================
  {
    folder: 'website',
    file: 'coned_web_gas_safety_emergencies.html',
    title: 'Con Edison Public Safety: Gas Leak Emergency Procedures & Reporting (coned.com)',
    content: `
      <h2>Smell Gas? Act Fast! Con Edison Emergency Safety Protocols</h2>
      <p>Natural gas is non-toxic and colorless. Con Edison adds an unpleasant odorant (mercaptan, resembling rotten eggs) so leaks can be detected immediately.</p>
      <h3>Immediate Action Rules:</h3>
      <ul>
        <li><strong>1. Evacuate Immediately:</strong> Leave the building or area immediately on foot. Do not use matches, lighters, or light switches. Do not ring doorbells, open windows, or use landline phones inside the building.</li>
        <li><strong>2. Do Not Start Vehicles:</strong> Do not turn vehicle ignitions on or off near a suspected gas odor.</li>
        <li><strong>3. Call 911 or Con Edison:</strong> Once at a safe distance away from the leak, call 911 immediately or call Con Edison's 24/7 emergency gas hotline at <strong>1-800-75-CONED (1-800-752-6633)</strong>.</li>
        <li><strong>4. Keep Out:</strong> Never enter or re-enter a building where you smell gas until utility crews and first responders declare it safe.</li>
      </ul>
    `
  },
  {
    folder: 'website',
    file: 'coned_web_outage_restoration_stages.html',
    title: 'Con Edison Service & Outages: Reporting, Tracking & Restoration Priorities (coned.com)',
    content: `
      <h2>Power Outage Reporting & Restoration Methodology</h2>
      <p>Customers can report electric service disruptions 24/7 through coned.com/outages, the Con Edison mobile app, or by calling 1-800-75-CONED.</p>
      <h3>Four-Stage Restoration Priority:</h3>
      <ul>
        <li><strong>Stage 1: Public Safety & Critical Care:</strong> Immediate isolation of downed live wires; prioritizing emergency services, hospitals, transit, police, fire, and water pumping stations.</li>
        <li><strong>Stage 2: Transmission & Bulk Supply:</strong> Repairing primary transmission corridors and network substations to re-energize major regional distribution hubs.</li>
        <li><strong>Stage 3: Main Distribution Lines:</strong> Restoring primary three-phase distribution feeders that serve hundreds or thousands of customers simultaneously.</li>
        <li><strong>Stage 4: Neighborhood Branches & Service Drops:</strong> Repairing local lateral transformers, secondary wiring, and individual residential service connections.</li>
      </ul>
      <h3>Dry Ice Distribution:</h3>
      <p>During prolonged weather-related interruptions exceeding 48 hours, Con Edison establishes community dry ice distribution centers in affected municipal parks and library parking lots.</p>
    `
  },
  {
    folder: 'website',
    file: 'coned_web_billing_assistance_heap_eap.html',
    title: 'Con Edison Customer Support: Payment Relief, HEAP Grants & Budget Billing (coned.com)',
    content: `
      <h2>Payment Plans, HEAP Grants & Budget Billing Options</h2>
      <p>Con Edison offers multiple relief programs to help New York families manage energy costs.</p>
      <h3>Available Programs:</h3>
      <ul>
        <li><strong>Level Payment Plan (Budget Billing):</strong> Averages your annual energy usage over 12 equal monthly installments, shielding you from seasonal summer AC cooling or winter heating spikes.</li>
        <li><strong>Home Energy Assistance Program (HEAP):</strong> Federally funded grants providing eligible households with up to several hundred dollars in direct energy assistance. Receiving HEAP automatically enrolls you in Con Edison's monthly Energy Affordability Program discounts.</li>
        <li><strong>Deferred Payment Agreements (DPA):</strong> Custom installment agreements allowing you to pay past-due balances over time with zero penalty interest charges.</li>
        <li><strong>Special Protections:</strong> Residential customers experiencing medical emergencies or households with life-support equipment qualify for mandatory disconnection protections.</li>
      </ul>
    `
  }
];

function run() {
  console.log('======================================================');
  console.log('   GENERATING CON EDISON DEEP KNOWLEDGE CORPUS');
  console.log('======================================================\n');

  const jsonlEntries = [];

  for (const doc of DOCUMENTS) {
    const targetDir = path.join(BASE_DIR, doc.folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, doc.file);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${doc.title}</title>
  <meta name="source" content="https://www.coned.com/en/${doc.folder}/${doc.file}">
</head>
<body>
  <h1>${doc.title}</h1>
  ${doc.content.trim()}
</body>
</html>`;

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  ✓ Created [${doc.folder}] ${doc.file}`);

    const gcsUri = `gs://pradeep-demo-1/coned-knowledge/${doc.folder}/${doc.file}`;
    const docId = `${doc.folder}_${path.basename(doc.file, '.html')}`;
    
    jsonlEntries.push(JSON.stringify({
      id: docId,
      structData: {},
      content: {
        mimeType: "text/html",
        uri: gcsUri
      }
    }));
  }

  // Write JSONL file
  const jsonlPath = path.join(BASE_DIR, 'deep_knowledge_index.jsonl');
  fs.writeFileSync(jsonlPath, jsonlEntries.join('\n') + '\n', 'utf8');
  console.log(`\n✓ Successfully generated JSONL index with ${jsonlEntries.length} documents: ${jsonlPath}\n`);

  // Upload to GCS
  console.log('Uploading all documents and JSONL index to Cloud Storage (gs://pradeep-demo-1/coned-knowledge/)...');
  try {
    execSync('CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud storage cp -r "' + BASE_DIR + '/*" gs://pradeep-demo-1/coned-knowledge/', {
      stdio: 'inherit'
    });
    console.log('✓ Successfully uploaded all documents to Cloud Storage!\n');
  } catch (err) {
    console.error('Failed to upload to Cloud Storage:', err.message);
    process.exit(1);
  }

  // Trigger Discovery Engine Incremental Import
  console.log('Triggering Discovery Engine Incremental Import for all 19 documents...');
  try {
    const curlCmd = `
      TOKEN=$(gcloud auth print-access-token)
      curl -s -X POST "https://us-discoveryengine.googleapis.com/v1alpha/projects/832497031659/locations/us/collections/default_collection/dataStores/coned-knowledge-base/branches/0/documents:import" \\
        -H "Authorization: Bearer $TOKEN" \\
        -H "X-Goog-User-Project: pradeep-demo-1" \\
        -H "Content-Type: application/json" \\
        -d '{
          "gcsSource": {
            "inputUris": [
              "gs://pradeep-demo-1/coned-knowledge/deep_knowledge_index.jsonl"
            ]
          },
          "reconciliationMode": "INCREMENTAL"
        }'
    `;
    const result = execSync(curlCmd).toString();
    console.log('Discovery Engine Import Operation Response:');
    console.log(result);
  } catch (err) {
    console.error('Failed to trigger Discovery Engine import:', err.message);
    process.exit(1);
  }
}

run();
