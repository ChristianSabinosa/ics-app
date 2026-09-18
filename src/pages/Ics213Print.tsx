import './Ics213Print.css'

interface Ics213PrintProps {
  incidentName: string
  msgDate: string
  msgTime: string
  toName: string
  toPosition: string
  fromName: string
  fromPosition: string
  subject: string
  message: string
  approvedByName: string
  approvedByPosition: string
  approvedBySig: string
  approvedDate: string
  approvedTime: string
  reply: string
  receivedByName: string
  receivedByPosition: string
  receivedBySig: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''

export default function Ics213Print(props: Ics213PrintProps) {
  const handlePrint = () => window.print()

  return (
    <div className="ics213-print-overlay">
      <div className="ics213-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics213-print-page">
        <table className="ics213-form">
          <thead>
            <tr>
              <td colSpan={2} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">GENERAL MESSAGE</div>
                    <div className="form-number">ICS 213</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Incident Name + Date/Time */}
            <tr>
              <td className="top-cell" style={{ width: '55%' }}>
                <div className="field-label">1. INCIDENT/ EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td className="top-cell">
                <div className="field-label">2. DATE / TIME</div>
                <div className="field-value">{props.msgDate || '\u00A0'} {fmtTime(props.msgTime) || '\u00A0'}</div>
              </td>
            </tr>

            {/* Row 2: To */}
            <tr>
              <td colSpan={2} className="content-cell">
                <div className="field-label">3. TO [NAME &amp; POSITION]</div>
                <div className="field-value">{props.toName || '\u00A0'}{props.toPosition ? ` - ${props.toPosition}` : ''}</div>
              </td>
            </tr>

            {/* Row 3: From */}
            <tr>
              <td colSpan={2} className="content-cell">
                <div className="field-label">4. FROM [NAME]</div>
                <div className="field-value">{props.fromName || '\u00A0'}{props.fromPosition ? ` - ${props.fromPosition}` : ''}</div>
              </td>
            </tr>

            {/* Row 4: Subject */}
            <tr>
              <td colSpan={2} className="content-cell">
                <div className="field-label">5. SUBJECT</div>
                <div className="field-value">{props.subject || '\u00A0'}</div>
              </td>
            </tr>

            {/* Row 5: Message */}
            <tr>
              <td colSpan={2} className="content-cell">
                <div className="field-label">6. MESSAGE</div>
                <div className="field-textarea">{props.message || '\u00A0'}</div>
              </td>
            </tr>

            {/* Row 6: Approved by */}
            <tr>
              <td className="sig-cell" colSpan={2}>
                <div className="sig-row-print">
                  <div className="sig-num">7. APPROVED BY</div>
                  <div className="sig-field-print">
                    <span className="sig-label">Name:</span>
                    <span className="sig-value">{props.approvedByName || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Position / Title:</span>
                    <span className="sig-value">{props.approvedByPosition || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Signature:</span>
                    <span className="sig-value">{props.approvedBySig || '\u00A0'}</span>
                  </div>
                </div>
              </td>
            </tr>

            {/* Row 7: Reply */}
            <tr>
              <td colSpan={2} className="content-cell reply-section">
                <div className="field-label">8. REPLY</div>
                <div className="field-textarea">{props.reply || '\u00A0'}</div>
              </td>
            </tr>

            {/* Row 8: Received by */}
            <tr>
              <td className="sig-cell" colSpan={2}>
                <div className="received-row">
                  <div className="sig-num">9. RECEIVED BY</div>
                  <div className="sig-field-print">
                    <span className="sig-label">Name:</span>
                    <span className="sig-value">{props.receivedByName || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Position / Title:</span>
                    <span className="sig-value">{props.receivedByPosition || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Signature:</span>
                    <span className="sig-value">{props.receivedBySig || '\u00A0'}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
