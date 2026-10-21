import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Package, PlusCircle } from 'lucide-react';
import { productFromDto, type LoanProduct, type ProductDto } from '../../shared/lending';
import { Button } from '../portal/components/ui/Button';
import { StatusBadge } from '../portal/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../portal/components/ui/States';
import { ProductModal } from './ProductModal';
import { ProductTerms } from './lending';

export interface ProductApi {
  list: () => Promise<ProductDto[]>;
  create: (dto: ProductDto) => Promise<unknown>;
  update: (id: string, dto: ProductDto) => Promise<unknown>;
}

interface ProductsViewProps {
  api: ProductApi;
  /** Whether the viewer may create and edit products (manage_settings). */
  canEdit: boolean;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ api, canEdit }) => {
  const [rows, setRows] = useState<{ dto: ProductDto; product: LoanProduct }[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await api.list();
      setRows(list.map((dto) => ({ dto, product: productFromDto(dto) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loan products could not be loaded.');
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (dto: ProductDto) => {
    if (editing?.id) await api.update(editing.id, dto);
    else await api.create(dto);
    await load();
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Loan products</h1>
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">Interest method and rate, limits, repayment frequency, fees and penalty for each product.</p>
        </div>
        {canEdit && (
          <Button variant="brand" onClick={() => setCreating(true)}>
            <PlusCircle className="h-4 w-4" /> New product
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !rows ? (
        <LoadingState label="Loading loan products…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title="No loan products yet" description={canEdit ? 'Create the first product to start taking applications.' : 'Ask head office to set up loan products.'} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ dto, product }) => (
            <div key={product.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full border border-gold-400/30 bg-gold-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-700">{product.category}</span>
                    <h3 className="mt-2 text-base font-bold text-gray-900">{product.name}</h3>
                    <span className="font-mono text-xs font-semibold text-gray-400">{product.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={product.status} />
                    {canEdit && (
                      <button onClick={() => setEditing(dto)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Edit product" aria-label={`Edit ${product.name}`}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {product.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500">{product.description}</p>}
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <ProductTerms product={product} />
                </div>
              </div>
              {(product.requiresCollateral || product.requiresGuarantor) && (
                <div className="mt-4 flex gap-2 text-[10px] font-semibold">
                  {product.requiresCollateral && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">Collateral</span>}
                  {product.requiresGuarantor && <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-purple-700">Guarantor</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ProductModal
        open={creating || !!editing}
        product={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </div>
  );
};
