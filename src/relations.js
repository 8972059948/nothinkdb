/* eslint no-shadow: 0 */
import r from 'rethinkdb';
import assert from 'assert';
import Link from './Link';


export function hasOne(link) {
  assert.equal(link.constructor, Link);

  function join(as, query, options = {}) {
    const { left, right } = link;
    const { before = query => query } = options;
    return query.merge(function(row) {
      let joinQuery = before(left.Model.query());
      joinQuery = joinQuery.getAll(row(right.field), { index: left.field });
      joinQuery = r.branch(joinQuery.count().gt(0), joinQuery.nth(0), null);
      return { [as]: joinQuery };
    });
  }
  return { join, link };
}

export function belongsTo(link) {
  assert.equal(link.constructor, Link);

  function join(as, query, options = {}) {
    const { left, right } = link;
    const { before = query => query } = options;
    return query.merge(function(row) {
      let joinQuery = before(right.Model.query());
      joinQuery = joinQuery.getAll(row(left.field), { index: right.field });
      joinQuery = r.branch(joinQuery.count().gt(0), joinQuery.nth(0), null);
      return { [as]: joinQuery };
    });
  }

  return { join, link };
}

export function hasMany(link) {
  assert.equal(link.constructor, Link);

  function join(as, query, options = {}) {
    const { left, right } = link;
    const { before = query => query } = options;
    return query.merge(function(row) {
      let joinQuery = before(left.Model.query());
      joinQuery = joinQuery.getAll(row(right.field), { index: left.field });
      joinQuery = joinQuery.coerceTo('array');
      return { [as]: joinQuery };
    });
  }
  function add(onePk, otherPk) {
    const { left, right } = link;
    return r.table(right.Model.table).get(onePk).do(function(rightRow) {
      return r.table(left.Model.table).get(otherPk).update({ [left.field]: rightRow(right.field) });
    });
  }
  function remove(leftPk) {
    const { left } = link;
    return r.table(left.Model.table).get(leftPk).update({ [left.field]: null });
  }
  return { join, add, remove, link };
}

export function belongsToMany(link) {
  assert.equal(link.length, 2);
  assert.equal(link[0].constructor, Link);
  assert.equal(link[1].constructor, Link);
  assert.equal(link[0].left.Model, link[1].left.Model);

  function join(as, query, options = {}) {
    const [link1, link2] = link;
    const { before = query => query } = options;
    return query.merge(function(row) {
      let joinQuery = before(link1.left.Model.query());
      joinQuery = joinQuery.getAll(row(link1.right.field), { index: link1.left.field }).coerceTo('array');
      joinQuery = joinQuery.concatMap(function(row) {
        return link2.right.Model.query().getAll(row(link2.left.field), { index: link2.right.field }).coerceTo('array');
      });
      return { [as]: joinQuery };
    });
  }
  function add(onePk, otherPk) {
    const [link1, link2] = link;
    const Relation = link1.left.Model;
    const relation = new Relation({
      [link1.left.field]: onePk,
      [link2.left.field]: otherPk,
    });
    return r.table(Relation.table).insert(relation.data, { conflict: 'replace' });
  }
  function remove(otherPk) {
    const [link1, link2] = link;
    const Relation = link1.left.Model;
    return r.table(Relation.table).getAll(otherPk, { index: link2.left.field }).delete();
  }
  return { join, add, remove, link };
}