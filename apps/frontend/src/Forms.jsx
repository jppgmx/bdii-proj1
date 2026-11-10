import { useEffect, useState } from 'react';
import { api } from './paradas.js';

const requiredName = (name, limit) => {
  if (!name) return 'Informe o nome.';
  if (name.length > limit) return `Use até ${limit} caracteres.`;
};
const lengthError = (value, limit) => value.length > limit ? `Use até ${limit} caracteres.` : undefined;

function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <small className="field-error" id={`${id}-error`}>{error}</small>}
    </div>
  );
}

function fieldProps(id, error) {
  return { id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined };
}

export function UniversityForm({ onCreated, disabled }) {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const nome = values.get('nome').trim();
    const sigla = values.get('sigla').trim();
    const campus = values.get('campus').trim();
    const invalid = { nome: requiredName(nome, 160), sigla: lengthError(sigla, 20), campus: lengthError(campus, 120) };
    setErrors(invalid);
    setMessage('');
    if (Object.values(invalid).some(Boolean)) return;

    setSaving(true);
    try {
      const university = await api('/api/universidades', {
        method: 'POST',
        body: { nome, sigla: sigla || null, campus: campus || null },
      });
      onCreated(university);
      form.reset();
      setMessage('Universidade cadastrada.');
    } catch (error) {
      setErrors(error.fields ?? {});
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={saving || disabled}>
        <legend>Cadastrar universidade</legend>
        <Field id="university-name" label="Nome da universidade" error={errors.nome}>
          <input name="nome" aria-required="true" {...fieldProps('university-name', errors.nome)} />
        </Field>
        <Field id="university-acronym" label="Sigla" error={errors.sigla}>
          <input name="sigla" {...fieldProps('university-acronym', errors.sigla)} />
        </Field>
        <Field id="university-campus" label="Campus" error={errors.campus}>
          <input name="campus" {...fieldProps('university-campus', errors.campus)} />
        </Field>
        <button>{saving ? 'Cadastrando…' : 'Cadastrar universidade'}</button>
        {message && <p role="status">{message}</p>}
      </fieldset>
    </form>
  );
}

export function StopForm({ stop, universities, newUniversity, point, busy, setBusy, onReset, onSaved }) {
  const [universityId, setUniversityId] = useState(stop?.universidade_id ?? newUniversity);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [lat, lng] = point ?? [];

  useEffect(() => {
    if (!stop && newUniversity) setUniversityId(newUniversity);
  }, [newUniversity, stop]);

  async function persist(path, method, body) {
    setBusy(true);
    try {
      await api(path, { method, body });
      onReset();
      onSaved();
    } catch (error) {
      setErrors(error.fields ?? {});
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const nome = values.get('nome').trim();
    const descricao = values.get('descricao').trim();
    const invalid = {
      nome: requiredName(nome, 120),
      descricao: lengthError(descricao, 500),
      universidade_id: universities.some(({ id }) => id === universityId) ? undefined : 'Selecione uma universidade cadastrada.',
      localizacao: Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        ? undefined : 'Selecione um ponto válido no mapa.',
    };
    setErrors(invalid);
    setMessage('');
    if (Object.values(invalid).some(Boolean)) return;

    persist(stop ? `/api/paradas/${stop.id}` : '/api/paradas', stop ? 'PUT' : 'POST', {
      nome,
      descricao: descricao || null,
      universidade_id: universityId,
      localizacao: { type: 'Point', coordinates: [lng, lat] },
    });
  }

  function remove() {
    if (!window.confirm(`Excluir a parada “${stop.nome}”?`)) return;
    setErrors({});
    setMessage('');
    persist(`/api/paradas/${stop.id}`, 'DELETE');
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{stop ? 'Editar parada' : 'Cadastrar parada'}</legend>
        <Field id="stop-name" label="Nome da parada" error={errors.nome}>
          <input name="nome" defaultValue={stop?.nome} aria-required="true" {...fieldProps('stop-name', errors.nome)} />
        </Field>
        <Field id="stop-description" label="Descrição" error={errors.descricao}>
          <textarea name="descricao" defaultValue={stop?.descricao ?? ''} {...fieldProps('stop-description', errors.descricao)} />
        </Field>
        <Field id="stop-university" label="Universidade" error={errors.universidade_id}>
          <select value={universityId} onChange={(event) => setUniversityId(event.target.value)}
            aria-required="true" {...fieldProps('stop-university', errors.universidade_id)}>
            <option value="">Selecione uma universidade</option>
            {universities.map(({ id, nome, sigla, campus }) => (
              <option key={id} value={id}>{[nome, sigla, campus].filter(Boolean).join(' · ')}</option>
            ))}
          </select>
        </Field>
        <Field id="stop-point" label="Coordenadas da parada" error={errors.localizacao}>
          <output {...fieldProps('stop-point', errors.localizacao)}>
            {point ? `Lat. ${lat.toFixed(6)}, long. ${lng.toFixed(6)}` : 'Clique no mapa para definir o ponto.'}
          </output>
        </Field>
        <button>{busy ? 'Processando…' : 'Salvar parada'}</button>
        <button type="button" onClick={onReset}>Cancelar</button>
        {stop && <button type="button" onClick={remove}>Excluir parada</button>}
        {message && <p role="alert">{message}</p>}
      </fieldset>
    </form>
  );
}
