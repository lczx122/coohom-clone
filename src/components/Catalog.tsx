import { catalog, categories } from '../data/catalog'
import { company } from '../config/company'
import { useDesignStore } from '../store/useDesignStore'
import { lengthValue } from '../lib/units'

export default function Catalog() {
  const placingProductId = useDesignStore((s) => s.placingProductId)
  const setPlacingProduct = useDesignStore((s) => s.setPlacingProduct)
  const unit = useDesignStore((s) => s.unit)
  const models = useDesignStore((s) => s.models)
  const placingModelId = useDesignStore((s) => s.placingModelId)
  const setPlacingModel = useDesignStore((s) => s.setPlacingModel)
  const deleteModel = useDesignStore((s) => s.deleteModel)

  return (
    <div className="sidebar">
      <div className="section-title">Custom Cabinets</div>
      <button
        className={`new-cabinet-btn ${placingModelId === '__new__' ? 'active' : ''}`}
        onClick={() => setPlacingModel(placingModelId === '__new__' ? null : '__new__')}
      >
        ＋ New cabinet
      </button>
      <div className="empty-note" style={{ margin: '6px 0 8px' }}>
        Click to start, place it on the plan, then double-click to open the
        cabinet editor.
      </div>
      {models.length === 0 && (
        <div className="empty-note">No saved cabinets yet. Build one and “Save as Model”.</div>
      )}
      {models.map((m) => (
        <div
          key={m.id}
          className={`product ${placingModelId === m.id ? 'active' : ''}`}
          onClick={() => setPlacingModel(placingModelId === m.id ? null : m.id)}
          title={`${m.spec.name} — place on the plan`}
        >
          <span className="swatch" style={{ background: m.spec.color }} />
          <div className="meta">
            <div className="pname">{m.spec.name}</div>
            <div className="pdim">
              {lengthValue(m.spec.width, unit)} × {lengthValue(m.spec.depth, unit)} {unit}
            </div>
          </div>
          <button
            className="model-del"
            title="Delete saved cabinet"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete saved cabinet "${m.spec.name}"?`)) deleteModel(m.id)
            }}
          >
            ✕
          </button>
        </div>
      ))}

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
                    {lengthValue(p.width, unit)} × {lengthValue(p.depth, unit)} {unit}
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
