/**
 * Reference Next.js page (spec). Production UI: Asterisk dashboard → sidebar "IPRN ranges"
 * (same APIs: GET/POST /api/iprn-inventory/ranges with session cookie to dashboard origin).
 */
import { useEffect, useState } from 'react';

export default function NumbersPage() {
  const [numbers, setNumbers] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/iprn-inventory/ranges', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.rows) setNumbers(data.rows);
        else if (data.error) setErr(data.error);
        else setNumbers([]);
      })
      .catch((e) => setErr(String(e.message)));
  }, []);

  if (err) {
    return (
      <div>
        <h1>Number Inventory</h1>
        <p>{err}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Number Inventory</h1>
      <table border="1">
        <thead>
          <tr>
            <th>Country</th>
            <th>Prefix</th>
            <th>Range</th>
            <th>Supplier</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {numbers.map((n) => (
            <tr key={n.id}>
              <td>{n.country}</td>
              <td>{n.prefix}</td>
              <td>
                {n.range_start} - {n.range_end}
              </td>
              <td>{n.supplier_name}</td>
              <td>{n.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
