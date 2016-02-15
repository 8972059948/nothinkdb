import r from 'rethinkdb';
import Joi from 'joi';
import uuid from 'node-uuid';
import { expect } from 'chai';
import Table from '../Table';
import Link from '../Link';
import { hasOne, belongsTo, hasMany, belongsToMany } from '../relations';


describe('Table', () => {
  let connection;
  before(async () => {
    connection = await r.connect({});
    await r.branch(r.dbList().contains('test').not(), r.dbCreate('test'), null).run(connection);
    r.dbCreate('test');
  });

  beforeEach(async () => {
    await r.branch(r.tableList().contains('foo').not(), r.tableCreate('foo'), null).run(connection);
    await r.branch(r.tableList().contains('bar').not(), r.tableCreate('bar'), null).run(connection);
    await r.branch(r.tableList().contains('foobar').not(), r.tableCreate('foobar'), null).run(connection);
  });

  after(async () => {
    await connection.close();
  });

  describe('staic', () => {
    describe('schema', () => {
      it('has default property', () => {
        expect(Table.schema).to.have.property('id');
        expect(Table.schema).to.have.property('createdAt');
        expect(Table.schema).to.have.property('updatedAt');
      });
    });
  });

  describe('constructor', () => {
    it('schema could be extended', () => {
      const baseTable = new Table({
        table: 'base',
        schema: () => ({
          ...Table.schema,
          name: Joi.string().default('hello'),
        }),
      });
      expect(baseTable.schema()).to.have.property('id');
      expect(baseTable.schema()).to.have.property('createdAt');
      expect(baseTable.schema()).to.have.property('updatedAt');
      expect(baseTable.schema()).to.have.property('name');
    });
  });

  describe('validate', () => {
    const fooTable = new Table({
      table: 'foo',
      schema: () => ({
        name: Joi.string().required(),
      }),
    });

    it('should return true when data is valid', () => {
      expect(fooTable.validate({ name: 'foo' })).to.be.true;
    });

    it('should throw error when invalid', () => {
      expect(fooTable.validate({})).to.be.false;
    });
  });

  describe('attempt', () => {
    const fooTable = new Table({
      table: 'foo',
      schema: () => ({
        foo: Joi.string().default('foo'),
        bar: Joi.string().required(),
      }),
    });

    it('should return with default properties', () => {
      const result = fooTable.attempt({ bar: 'bar' });
      expect(result).to.have.property('foo', 'foo');
      expect(result).to.have.property('bar', 'bar');
    });

    it('should throw error when invalid', () => {
      expect(() => fooTable.attempt({})).to.throw(Error);
    });
  });

  describe('create', () => {
    const fooTable = new Table({
      table: 'foo',
      schema: () => ({
        foo: Joi.string().default('foo'),
        bar: Joi.string().required(),
      }),
    });

    it('should return with default properties', () => {
      const result = fooTable.create({ bar: 'bar' });
      expect(result).to.have.property('foo', 'foo');
      expect(result).to.have.property('bar', 'bar');
    });

    it('should throw error when invalid', () => {
      expect(() => fooTable.create({})).to.throw(Error);
    });
  });

  describe('hasField', () => {
    it('should return true when specified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });
      expect(fooTable.hasField('name')).to.be.true;
    });

    it('should return false when unspecified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({}),
      });
      expect(fooTable.hasField('name')).to.be.false;
    });
  });

  describe('assertField', () => {
    it('should not throw error when specified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });
      expect(() => fooTable.assertField('name')).to.not.throw(Error);
    });

    it('should throw error when unspecified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({}),
      });
      expect(() => fooTable.assertField('name')).to.throw(Error);
    });
  });

  describe('getField', () => {
    it('should return field schema when specified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });

      const field = fooTable.getField('name');
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should throw error when unspecified fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({}),
      });
      expect(() => fooTable.getField('name')).to.throw(Error);
    });
  });

  describe('getForeignKey', () => {
    it('should return primary key schema when any argument is not given', () => {
      const fooTable = new Table({
        table: 'foo',
        pk: 'name',
        schema: () => ({
          name: Joi.string().default(() => uuid.v4(), 'pk'),
        }),
      });

      const field = fooTable.getForeignKey();
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should return field schema when options.fieldName is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          name: Joi.string().default(() => uuid.v4(), 'pk'),
        }),
      });

      const field = fooTable.getForeignKey({ fieldName: 'name' });
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should return and default(null) schema when options.isManyToMany is not given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
      });

      const field = fooTable.getForeignKey();
      expect(field).to.be.ok;
      expect(Joi.attempt(undefined, field)).to.be.null;
    });

    it('should return required() field schema when options.isManyToMany is given', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
      });

      const field = fooTable.getForeignKey({ isManyToMany: true });
      expect(field).to.be.ok;
      expect(() => Joi.assert(undefined, field)).to.throw(Error);
    });
  });

  describe('linkTo', () => {
    it('should return link', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          barId: barTable.getForeignKey(),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
        }),
      });

      const foo2bar = fooTable.linkTo(barTable, 'barId');
      expect(foo2bar).to.be.ok;
      expect(foo2bar.constructor).to.equal(Link);
      expect(foo2bar.left).to.deep.equal({
        table: fooTable, field: 'barId',
      });
      expect(foo2bar.right).to.deep.equal({
        table: barTable, field: 'id',
      });
    });
  });

  describe('linkedBy', () => {
    it('should return reverse link', () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey(),
        }),
      });

      const foo2bar = fooTable.linkedBy(barTable, 'fooId');
      expect(foo2bar).to.be.ok;
      expect(foo2bar.constructor).to.equal(Link);
      expect(foo2bar.left).to.deep.equal({
        table: barTable, field: 'fooId',
      });
      expect(foo2bar.right).to.deep.equal({
        table: fooTable, field: 'id',
      });
    });
  });

  describe('query', () => {
    it('should return table query', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
      });
      const config = await fooTable.query().config().run(connection);
      expect(config).to.have.property('name', 'foo');
    });
  });

  describe('insert', () => {
    it('should insert data into database', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          name: Joi.string().required(),
        }),
      });
      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const fetchedfooTable = await fooTable.query().get(foo.id).run(connection);
      expect(foo).to.deep.equal(fetchedfooTable);
    });
  });

  describe('get', () => {
    it('should get data from database', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          name: Joi.string().required(),
        }),
      });
      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const fetchedfooTable = await fooTable.get(foo.id).run(connection);
      expect(foo).to.deep.equal(fetchedfooTable);
    });
  });

  describe('update', () => {
    it('should update data into database', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          name: Joi.string().required(),
        }),
      });
      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      await fooTable.update(foo.id, { name: 'bar' }).run(connection);
      const fetchedfooTable = await fooTable.get(foo.id).run(connection);
      expect(fetchedfooTable).to.have.property('name', 'bar');
    });
  });

  describe('delete', () => {
    it('should delete data from database', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          name: Joi.string().required(),
        }),
      });
      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      await fooTable.delete(foo.id).run(connection);
      const fetchedfooTable = await fooTable.query().get(foo.id).run(connection);
      expect(fetchedfooTable).to.be.null;
    });
  });

  describe('withJoin', () => {
    it('should query hasOne relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bar: hasOne(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);

      const foo = fooTable.create({});
      const bar = barTable.create({ fooId: foo.id });

      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);

      let query = fooTable.get(foo.id);
      query = await fooTable.withJoin(query, { bar: true });
      const fetchedfooTable = await query.run(connection);
      expect(bar).to.deep.equal(fetchedfooTable.bar);
    });

    it('should query belongsTo relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
          barId: barTable.getForeignKey(),
        }),
        relations: () => ({
          bar: belongsTo(fooTable.linkTo(barTable, 'barId')),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);

      const bar = barTable.create({});
      const foo = fooTable.create({ barId: bar.id });

      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);

      let query = fooTable.get(foo.id);
      query = fooTable.withJoin(query, { bar: true });
      const fetchedfooTable = await query.run(connection);
      expect(bar).to.deep.equal(fetchedfooTable.bar);
    });

    it('should query hasMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: hasMany(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);

      const foo = fooTable.create({});
      const bar = barTable.create({ fooId: foo.id });

      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);

      let query = fooTable.get(foo.id);
      query = fooTable.withJoin(query, { bars: true });
      const fetchedfooTable = await query.run(connection);
      expect(fetchedfooTable.bars).to.have.length(1);
      expect(bar).to.deep.equal(fetchedfooTable.bars[0]);
    });

    it('should query belongsToMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: belongsToMany([fooTable.linkedBy(foobarTable, 'fooId'), foobarTable.linkTo(barTable, 'barId')]),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          foos: belongsToMany([barTable.linkedBy(foobarTable, 'barId'), foobarTable.linkTo(fooTable, 'fooId')]),
        }),
      });
      const foobarTable = new Table({
        table: 'foobar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey({ isManyToMany: true }),
          barId: barTable.getForeignKey({ isManyToMany: true }),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
      await foobarTable.sync(connection);

      const foo = fooTable.create({});
      const bar = barTable.create({});
      const foobar = foobarTable.create({ fooId: foo.id, barId: bar.id });

      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);
      await foobarTable.insert(foobar).run(connection);

      let query = fooTable.get(foo.id);
      query = fooTable.withJoin(query, { bars: true });
      const fetchedfooTable = await query.run(connection);
      expect(fetchedfooTable.bars).to.have.length(1);
      expect(bar).to.deep.equal(fetchedfooTable.bars[0]);

      query = barTable.get(bar.id);
      query = barTable.withJoin(query, { foos: true });
      const fetchedbarTable = await query.run(connection);
      expect(fetchedbarTable.foos).to.have.length(1);
      expect(foo).to.deep.equal(fetchedbarTable.foos[0]);
    });
  });

  describe('createRelation', () => {
    it('should add hasMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: hasMany(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);

      const foo = fooTable.create({});
      const bar = barTable.create({});
      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);
      await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

      let fooQuery = fooTable.get(foo.id);
      fooQuery = fooTable.withJoin(fooQuery, { bars: true });
      const fetchedfooTable = await fooQuery.run(connection);
      expect(fetchedfooTable.bars).to.have.length(1);
      expect(fetchedfooTable.bars[0]).to.have.property('fooId', foo.id);
    });

    it('should add belongsToMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: belongsToMany([fooTable.linkedBy(foobarTable, 'fooId'), foobarTable.linkTo(barTable, 'barId')]),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          foos: belongsToMany([barTable.linkedBy(foobarTable, 'barId'), foobarTable.linkTo(fooTable, 'fooId')]),
        }),
      });
      const foobarTable = new Table({
        table: 'foobar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey({ isManyToMany: true }),
          barId: barTable.getForeignKey({ isManyToMany: true }),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
      await foobarTable.sync(connection);

      const foo = fooTable.create({});
      const bar = barTable.create({});
      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar).run(connection);
      await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

      const fooQuery = fooTable.get(foo.id);
      const fetchedfooTable = await fooTable.withJoin(fooQuery, { bars: true }).run(connection);
      expect(bar.id).to.equal(fetchedfooTable.bars[0].id);

      const barQuery = barTable.get(bar.id);
      const fetchedbarTable = await barTable.withJoin(barQuery, { foos: true }).run(connection);
      expect(foo.id).to.equal(fetchedbarTable.foos[0].id);
    });
  });

  describe('removeRelation', () => {
    it('should remove hasMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: hasMany(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);

      const foo = fooTable.create({});
      const bar1 = barTable.create({});
      const bar2 = barTable.create({});
      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar1).run(connection);
      await barTable.insert(bar2).run(connection);
      await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
      await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

      await fooTable.removeRelation('bars', foo.id, bar1.id).run(connection);

      let fooQuery = fooTable.get(foo.id);
      fooQuery = fooTable.withJoin(fooQuery, { bars: true });
      const fetchedfooTable = await fooQuery.run(connection);
      expect(fetchedfooTable.bars).to.have.length(1);
      expect(bar2.id).to.equal(fetchedfooTable.bars[0].id);
    });

    it('should remove belongsToMany relation', async () => {
      const fooTable = new Table({
        table: 'foo',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          bars: belongsToMany([fooTable.linkedBy(foobarTable, 'fooId'), foobarTable.linkTo(barTable, 'barId')]),
        }),
      });
      const barTable = new Table({
        table: 'bar',
        schema: () => ({
          ...Table.schema,
        }),
        relations: () => ({
          foos: belongsToMany([barTable.linkedBy(foobarTable, 'barId'), foobarTable.linkTo(fooTable, 'fooId')]),
        }),
      });
      const foobarTable = new Table({
        table: 'foobar',
        schema: () => ({
          ...Table.schema,
          fooId: fooTable.getForeignKey({ isManyToMany: true }),
          barId: barTable.getForeignKey({ isManyToMany: true }),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
      await foobarTable.sync(connection);

      const foo = fooTable.create({});
      const bar1 = barTable.create({});
      const bar2 = barTable.create({});
      await fooTable.insert(foo).run(connection);
      await barTable.insert(bar1).run(connection);
      await barTable.insert(bar2).run(connection);
      await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
      await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

      await fooTable.removeRelation('bars', foo.id, bar1.id).run(connection);

      const fooQuery = fooTable.get(foo.id);
      const fetchedfooTable = await fooTable.withJoin(fooQuery, { bars: true }).run(connection);
      expect(fetchedfooTable.bars).to.have.length(1);
      expect(bar2.id).to.equal(fetchedfooTable.bars[0].id);

      const barQuery = barTable.get(bar2.id);
      const fetchedbarTable = await barTable.withJoin(barQuery, { foos: true }).run(connection);
      expect(fetchedbarTable.foos).to.have.length(1);
      expect(foo.id).to.equal(fetchedbarTable.foos[0].id);
    });
  });
});
