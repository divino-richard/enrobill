import schoolLogo from '@/assets/northlink-logo.png?inline';

// Both print templates are standalone HTML documents.
export const printBrand = `
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${schoolLogo}" alt="Northlink Technological College" width="56" height="56" style="object-fit:contain;flex:none" />
    <div>
      <div class="brand">ENROBILL</div>
      <div class="brand-sub">Enrollment &amp; Tuition Management</div>
    </div>
  </div>`;
