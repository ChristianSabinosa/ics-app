import type { CheckinManifest, CheckinPersonnel, CheckinVehicle, CheckinEquipment } from '../lib/types'
import './CheckInPrint.css'

interface CheckInPrintProps {
  manifest: CheckinManifest
  personnel: CheckinPersonnel[]
  vehicles: CheckinVehicle[]
  equipment: CheckinEquipment[]
}

export default function CheckInPrint({ manifest, personnel, vehicles, equipment }: CheckInPrintProps) {
  const leader = personnel.find((p) => p.role === 'Leader')
  const landCount = vehicles.filter((v) => v.method_of_travel === 'Land').length
  const waterCount = vehicles.filter((v) => v.method_of_travel === 'Water').length
  const airCount = vehicles.filter((v) => v.method_of_travel === 'Air').length

  return (
    <div className="print-only">
      {/* PAGE 1: Personnel */}
      <div className="print-page">
        <table className="form-frame">
          <tbody>
            <tr>
              <td>
                <table className="form-header">
                  <tbody>
                    <tr>
                      <td className="logo-cell">
                        <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                      </td>
                      <td className="title-cell">
                        <h1>CHECK-IN MANIFEST</h1>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="info-fields">
                  <tbody>
                    <tr>
                      <td className="field-label">1. NAME Of AGENCY / OFFICE / HOME BASE</td>
                      <td className="field-value">{manifest.agency_name}</td>
                    </tr>
                    <tr>
                      <td className="field-label">2. NAME Of LEADER</td>
                      <td className="field-value">{leader?.name || ''}</td>
                    </tr>
                    <tr>
                      <td className="field-label">3. CONTACT DETAILS</td>
                      <td className="field-value">{leader?.contact_details || ''}</td>
                    </tr>
                    <tr>
                      <td className="field-label-center" colSpan={2}>
                        4. TOTAL NUMBER OF PERSONNEL: {manifest.total_personnel}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="data-table personnel-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Weight (kg)</th>
                      <th>Contact Details</th>
                      <th>Capabilities/ Specialization</th>
                      <th>Others</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personnel.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{p.age}</td>
                        <td>{p.gender}</td>
                        <td>{p.weight}</td>
                        <td>{p.contact_details}</td>
                        <td>{p.capabilities}</td>
                        <td>{p.others}</td>
                      </tr>
                    ))}
                    {personnel.length < 15 && Array.from({ length: Math.max(0, 15 - personnel.length) }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="additional-sheet-note">Use additional sheet as necessary</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PAGE 2: Vehicles + Equipment + Others */}
      <div className="print-page">
        <table className="form-frame">
          <tbody>
            <tr>
              <td>
                <table className="info-fields">
                  <tbody>
                    <tr>
                      <td className="field-label-center">
                        5. TOTAL NUMBER OF VEHICLES: {manifest.total_vehicles}
                      </td>
                    </tr>
                    <tr>
                      <td className="field-label-center sub-counts">
                        LAND: {landCount || '___'}
                        &nbsp;&nbsp;&nbsp;
                        WATER: {waterCount || '___'}
                        &nbsp;&nbsp;&nbsp;
                        AIR: {airCount || '___'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="data-table vehicle-table">
                  <thead>
                    <tr>
                      <th>Name of Operator</th>
                      <th>Kind</th>
                      <th>Type</th>
                      <th>Method of Travel</th>
                      <th>Plate Number</th>
                      <th>Fuel Type</th>
                      <th>Weight (kg)</th>
                      <th>Contact Details</th>
                      <th>Capabilities/ Specialization</th>
                      <th>Others</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v, i) => (
                      <tr key={i}>
                        <td>{v.operator_name}</td>
                        <td>{v.kind}</td>
                        <td>{v.type}</td>
                        <td>{v.method_of_travel}</td>
                        <td>{v.plate_number}</td>
                        <td>{v.fuel_type}</td>
                        <td>{v.weight}</td>
                        <td>{v.contact_details}</td>
                        <td>{v.capabilities}</td>
                        <td>{v.others}</td>
                      </tr>
                    ))}
                    {vehicles.length < 5 && Array.from({ length: Math.max(0, 5 - vehicles.length) }).map((_, i) => (
                      <tr key={`empty-v-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="additional-sheet-note">Use additional sheet as necessary</div>

                <table className="info-fields">
                  <tbody>
                    <tr>
                      <td className="field-label-center">
                        6. TOTAL NUMBER OF EQUIPMENT: {manifest.total_equipment}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="data-table equipment-table">
                  <thead>
                    <tr>
                      <th>Name of Operator</th>
                      <th>Kind</th>
                      <th>Type</th>
                      <th>Source of Power</th>
                      <th>Fuel Type</th>
                      <th>Weight (kg)</th>
                      <th>Contact Details</th>
                      <th>Capabilities/ Specialization</th>
                      <th>Others</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq, i) => (
                      <tr key={i}>
                        <td>{eq.operator_name}</td>
                        <td>{eq.kind}</td>
                        <td>{eq.type}</td>
                        <td>{eq.source_of_power}</td>
                        <td>{eq.fuel_type}</td>
                        <td>{eq.weight}</td>
                        <td>{eq.contact_details}</td>
                        <td>{eq.capabilities}</td>
                        <td>{eq.others}</td>
                      </tr>
                    ))}
                    {equipment.length < 5 && Array.from({ length: Math.max(0, 5 - equipment.length) }).map((_, i) => (
                      <tr key={`empty-e-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="additional-sheet-note">Use additional sheet as necessary</div>

                <table className="info-fields">
                  <tbody>
                    <tr>
                      <td className="field-label-center">7. OTHERS: {manifest.others}</td>
                    </tr>
                    <tr>
                      <td className="others-lines">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="others-line">&nbsp;</div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="additional-sheet-note">Use additional sheet as necessary</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
