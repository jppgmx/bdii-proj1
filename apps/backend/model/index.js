import { DataTypes } from 'sequelize';

export function defineModels(database) {
  if (database.models.Universidade && database.models.Parada && database.models.Onibus) return database.models;
  const id = () => ({ type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true });
  const Universidade = database.define('Universidade', {
    id: id(),
    nome: { type: DataTypes.STRING(160), allowNull: false },
    sigla: DataTypes.STRING(20),
    campus: DataTypes.STRING(120),
  }, { tableName: 'universidades' });
  const Parada = database.define('Parada', {
    id: id(),
    nome: { type: DataTypes.STRING(120), allowNull: false },
    descricao: DataTypes.STRING(500),
    universidade_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'universidades', key: 'id' } },
    localizacao: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: false },
  }, { tableName: 'paradas' });
  Parada.prototype.toJSON = function () {
    const data = this.get({ plain: true });
    // Sequelize inclui metadados de CRS; a API publica apenas o Point contratado.
    data.localizacao = { type: 'Point', coordinates: data.localizacao.coordinates };
    return data;
  };
  const Onibus = database.define('Onibus', {
    id: id(),
    identificacao: { type: DataTypes.STRING(60), allowNull: false },
    universidade_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'universidades', key: 'id' } },
    posicao_atual: { type: DataTypes.GEOMETRY('POINT', 4326), defaultValue: null },
    posicao_atualizada_em: { type: DataTypes.DATE, defaultValue: null },
  }, { tableName: 'onibus' });
  Onibus.prototype.toJSON = function () {
    const data = this.get({ plain: true });
    if (data.posicao_atual) data.posicao_atual = { type: 'Point', coordinates: data.posicao_atual.coordinates };
    return data;
  };
  return { Universidade, Parada, Onibus };
}
