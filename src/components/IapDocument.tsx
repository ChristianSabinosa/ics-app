import Ics202Print from '../pages/Ics202Print'
import Ics203Print from '../pages/Ics203Print'
import Ics204Print from '../pages/Ics204Print'
import Ics205Print from '../pages/Ics205Print'
import Ics206Print from '../pages/Ics206Print'
import Ics208Print from '../pages/Ics208Print'
import type { IapData } from '../lib/iap'
import { formatOpPeriod } from '../lib/iap'
import './IapDocument.css'

const noop = () => {}

interface IapDocumentProps {
  data: IapData
  coverImage: string
}

/**
 * Renders the full Incident Action Plan document:
 * cover page, ICS 202, 203, every 204, 205, 206, 208 and the Incident Map.
 * Each ICS print component is embedded inline (their overlays are neutralised by IapDocument.css).
 */
export default function IapDocument({ data, coverImage }: IapDocumentProps) {
  const op = {
    opFromDate: data.op.from_date,
    opFromTime: data.op.from_time,
    opToDate: data.op.to_date,
    opToTime: data.op.to_time,
  }
  const name = data.incident_name
  const f202 = data.form202
  const f203 = data.form203
  const f205 = data.form205
  const f206 = data.form206
  const f208 = data.form208

  const opLabel = formatOpPeriod(data.op)
  const icName = data.form203?.positions.find((p) => p.position_key === 'ic')?.person_name || ''

  return (
    <div className="iap-doc">
      {coverImage && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">Cover Page</div>
          <div className="iap-a4-page iap-cover-page">
            <div className="iap-cover-header">
              <span className="iap-cover-kicker">Incident Action Plan</span>
              <span className="iap-cover-name">{name || 'Incident'}</span>
            </div>
            <div className="iap-cover-image">
              <img src={coverImage} alt="Incident Action Plan cover page" />
            </div>
            <div className="iap-cover-footer">
              <span className="iap-cover-field">
                <span className="iap-cover-label">Operational Period</span>
                <strong>{opLabel || '—'}</strong>
              </span>
              <span className="iap-cover-field">
                <span className="iap-cover-label">IC</span>
                <strong>{icName || '—'}</strong>
              </span>
            </div>
          </div>
        </section>
      )}

      {f202 && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">ICS 202 &mdash; Incident Objectives</div>
          <Ics202Print
            incidentName={name}
            {...op}
            objectives={f202.objectives}
            commandEmphasis={f202.command_emphasis}
            weatherForecast={f202.weather_forecast}
            safetyMessage={f202.safety_message}
            safetyPlanRequired={f202.safety_plan_required}
            safetyPlanLocation={f202.safety_plan_location}
            attach203={f202.attach_203}
            attach204={f202.attach_204}
            attach205={f202.attach_205}
            attach206={f202.attach_206}
            attach209={f202.attach_209}
            attachMap={f202.attach_map}
            attachOthers={f202.attach_others}
            attachOthersText={f202.attach_others_text}
            preparedByName={f202.prepared_by_name}
            preparedBySig={f202.prepared_by_sig}
            preparedDate={f202.prepared_date}
            preparedTime={f202.prepared_time}
            approvedByName={f202.approved_by_name}
            approvedBySig={f202.approved_by_sig}
            approvedDate={f202.approved_date}
            approvedTime={f202.approved_time}
            onClose={noop}
          />
        </section>
      )}

      {f203 && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">ICS 203 &mdash; Organization Assignment List</div>
          <Ics203Print
            incidentName={name}
            {...op}
            positions={f203.positions}
            preparedByName={f203.prepared_by_name}
            preparedBySig={f203.prepared_by_sig}
            preparedDate={f203.prepared_date}
            preparedTime={f203.prepared_time}
            onClose={noop}
          />
        </section>
      )}

      {data.forms204.map((f204) => (
        <section className="iap-doc-section" key={f204.id}>
          <div className="iap-section-label iap-no-print">
            ICS 204 &mdash; Assignment List
            {f204.division || f204.group_name || f204.branch ? ` · ${f204.division || f204.group_name || f204.branch}` : ''}
          </div>
          <Ics204Print
            incidentName={name}
            {...op}
            branch={f204.branch}
            groupName={f204.group_name}
            division={f204.division}
            stagingArea={f204.staging_area}
            opsPersonnel={f204.ops_personnel}
            resourceRows={f204.rows}
            specificWorkAssignment={f204.specific_work_assignment}
            specialInstructions={f204.special_instructions}
            comms={f204.comms}
            preparedByName={f204.prepared_by_name}
            preparedBySig={f204.prepared_by_sig}
            preparedDate={f204.prepared_date}
            preparedTime={f204.prepared_time}
            onClose={noop}
          />
        </section>
      ))}

      {f205 && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">ICS 205 &mdash; Communications Plan</div>
          <Ics205Print
            incidentName={name}
            {...op}
            channels={f205.channels}
            coordinatingInstructions={f205.coordinating_instructions}
            preparedBy={f205.prepared_by}
            datePrepared={f205.date_prepared}
            timePrepared={f205.time_prepared}
            onClose={noop}
          />
        </section>
      )}

      {f206 && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">ICS 206 &mdash; Medical Plan</div>
          <Ics206Print
            incidentName={name}
            {...op}
            aidStations={f206.aid_stations}
            ambulances={f206.ambulances}
            hospitals={f206.hospitals}
            medicalEmergencyProcedures={f206.medical_emergency_procedures}
            aviationAssetsUsed={f206.aviation_assets_used}
            preparedBy={f206.prepared_by}
            datePrepared={f206.date_prepared}
            timePrepared={f206.time_prepared}
            reviewedBy={f206.reviewed_by}
            dateReviewed={f206.date_reviewed}
            timeReviewed={f206.time_reviewed}
            onClose={noop}
          />
        </section>
      )}

      {f208 && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">ICS 208 &mdash; Safety Message/Plan</div>
          <Ics208Print
            incidentName={name}
            {...op}
            safetyMessage={f208.safety_message}
            safetyPlanRequired={f208.safety_plan_required}
            safetyPlanLocation={f208.safety_plan_location}
            preparedByName={f208.prepared_by_name}
            preparedDate={f208.prepared_date}
            preparedTime={f208.prepared_time}
            onClose={noop}
          />
        </section>
      )}

      {data.map_image && (
        <section className="iap-doc-section">
          <div className="iap-section-label iap-no-print">Incident Map</div>
          <div className="iap-a4-page iap-map-page">
            <img src={data.map_image} alt="Incident map" />
          </div>
        </section>
      )}
    </div>
  )
}
