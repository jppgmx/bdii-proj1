import { DataTypes } from 'sequelize';

export function defineModels(database) {
  if (database.models.Universidade && database.models.Parada) return database.models;
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
  return { Universidade, Parada };
}
