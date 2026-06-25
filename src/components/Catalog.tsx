import { catalog, categories } from '../data/catalog'
import { company } from '../config/company'
import { useDesignStore } from '../store/useDesignStore'

export default function Catalog() {
  const placingProductId = useDesignStore((s) => s.placingProductId)
  const setPlacingProduct = useDesignStore((s) => s.setPlacingProduct)

  return (
    <div className="sidebar">
      <div className="section-title">Catalog</div>
      <div className="empty-note" style={{ marginBottom: 8 }}>
        Click a product, then click on the plan to place it. Click again to place
        more; press Esc to stop.
      </div>

      {categories.map((cat) => {
        const products = catalog.filter((p) => p.category === cat)
        if (products.length === 0) return null
        return (
          <div className="cat-group" key={cat}>
            <div className="cat-head">{cat}</div>
            {products.map((p) => (
              <div
                key={p.id}
                className={`product ${placingProductId === p.id ? 'active' : ''}`}
                onClick={() =>
                  setPlacingProduct(placingProductId === p.id ? null : p.id)
                }
                title={`${p.name} — ${p.width}×${p.depth} m`}
              >
                <span className="swatch" style={{ background: p.color }} />
                <div className="meta">
                  <div className="pname">{p.name}</div>
                  <div className="pdim">
                    {p.width.toFixed(2)} × {p.depth.toFixed(2)} m
                  </div>
                </div>
                {p.price != null && (
                  <div className="pprice">
                    {company.currency}
                    {p.price}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
