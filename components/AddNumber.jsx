/**
 * Reference form (spec). Production: dashboard "IPRN ranges" page.
 */
export default function AddNumber() {
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    await fetch('/api/iprn-inventory/ranges', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form)),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (typeof location !== 'undefined') location.reload();
  }

  return (
    <form onSubmit={submit}>
      <input name="country" placeholder="Country" />
      <input name="prefix" placeholder="Prefix" />
      <input name="range_start" placeholder="Start" />
      <input name="range_end" placeholder="End" />
      <input name="supplier_id" placeholder="Supplier ID" />
      <select name="access_type">
        <option value="IVR">IVR</option>
        <option value="DIRECT">Direct</option>
        <option value="SIP">SIP</option>
      </select>
      <button type="submit">Add Number</button>
    </form>
  );
}
