/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import {
  expectPassesRule,
  expectFailsRule,
  expectFailsRuleWithSchema,
  expectPassesRuleWithSchema
} from './harness';
import OverlappingFieldsCanBeMerged
  from '../rules/OverlappingFieldsCanBeMerged';
import { fieldsConflictMessage } from '../errors';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString
} from '../../type';


describe('Validate: Overlapping fields can be merged', () => {

  it('unique fields', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment uniqueFields on Dog {
        name
        nickname
      }
    `);
  });

  it('identical fields', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeIdenticalFields on Dog {
        name
        name
      }
    `);
  });

  it('identical fields with identical args', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('identical fields with identical directives', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeSameFieldsWithSameDirectives on Dog {
        name @if:true
        name @if:true
      }
    `);
  });

  it('different args with different aliases', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment differentArgsWithDifferentAliases on Dog {
        knowsSit : doesKnowCommand(dogCommand: SIT)
        knowsDown : doesKnowCommand(dogCommand: DOWN)
      }
    `);
  });

  it('different directives with different aliases', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment differentDirectivesWithDifferentAliases on Dog {
        nameIfTrue : name @if:true
        nameIfFalse : name @if:false
      }
    `);
  });

  it('Same aliases with different field targets', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        fido : name
        fido : nickname
      }
    `, [
      { message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] },
    ]);
  });

  it('Alias masking direct field access', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment aliasMaskingDirectFieldAccess on Dog {
        name : nickname
        name
      }
    `, [
      { message: fieldsConflictMessage(
          'name',
          'nickname and name are different fields'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] },
    ]);
  });

  it('conflicting args', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: HEEL)
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
    ]);
  });

  it('conflicting directives', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingDirectiveArgs on Dog {
        name @if: true
        name @unless: false
      }
    `, [
      { message: fieldsConflictMessage(
          'name',
          'they have differing directives'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
    ]);
  });

  it('conflicting args with matching directives', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingArgsWithMatchingDirectiveArgs on Dog {
        doesKnowCommand(dogCommand: SIT) @if:true
        doesKnowCommand(dogCommand: HEEL) @if:true
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
    ]);
  });

  it('conflicting directives with matching args', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingDirectiveArgsWithMatchingArgs on Dog {
        doesKnowCommand(dogCommand: SIT) @if: true
        doesKnowCommand(dogCommand: SIT) @unless: false
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing directives'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
    ]);
  });

  it('encounters conflict in fragments', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        ...A
        ...B
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `, [
      { message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [ { line: 7, column: 9 }, { line: 10, column: 9 } ] }
    ]);
  });

  it('reports each conflict once', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        f1 {
          ...A
          ...B
        }
        f2 {
          ...B
          ...A
        }
        f3 {
          ...A
          ...B
          x: c
        }
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `, [
      { message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [ { line: 18, column: 9 }, { line: 21, column: 9 } ] },
      { message: fieldsConflictMessage('x', 'a and c are different fields'),
        locations: [ { line: 18, column: 9 }, { line: 14, column: 11 } ] },
      { message: fieldsConflictMessage('x', 'b and c are different fields'),
        locations: [ { line: 21, column: 9 }, { line: 14, column: 11 } ] }
    ]);
  });

  it('deep conflict', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          x: a
        },
        field {
          x: b
        }
      }
    `, [
      { message: fieldsConflictMessage(
          'field', [['x', 'a and b are different fields']]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
          { line: 4, column: 11 },
          { line: 7, column: 11 } ] },
    ]);
  });

  it('deep conflict with multiple issues', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          x: a
          y: c
        },
        field {
          x: b
          y: d
        }
      }
    `, [
      { message: fieldsConflictMessage(
          'field', [
            ['x', 'a and b are different fields'],
            ['y', 'c and d are different fields']
          ]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 7, column: 9 },
          { line: 4, column: 11 },
          { line: 8, column: 11 },
          { line: 5, column: 11 },
          { line: 9, column: 11 } ] },
    ]);
  });

  it('very deep conflict', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          deepField {
            x: a
          }
        },
        field {
          deepField {
            x: b
          }
        }
      }
    `, [
      { message: fieldsConflictMessage(
          'field', [['deepField', [['x', 'a and b are different fields']]]]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 8, column: 9 },
          { line: 4, column: 11 },
          { line: 9, column: 11 },
          { line: 5, column: 13 },
          { line: 10, column: 13 } ] },
    ]);
  });

  it('reports deep conflict to nearest common ancestor', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          deepField {
            x: a
          }
          deepField {
            x: b
          }
        },
        field {
          deepField {
            y
          }
        }
      }
    `, [
      { message: fieldsConflictMessage(
          'deepField', [['x', 'a and b are different fields']]
        ),
        locations: [
          { line: 4, column: 11 },
          { line: 7, column: 11 },
          { line: 5, column: 13 },
          { line: 8, column: 13 } ] },
    ]);
  });

  describe('return types must be unambiguous', () => {

    var StringBox = new GraphQLObjectType({
      name: 'StringBox',
      fields: {
        scalar: { type: GraphQLString }
      }
    });

    var IntBox = new GraphQLObjectType({
      name: 'IntBox',
      fields: {
        scalar: { type: GraphQLInt }
      }
    });

    var NonNullStringBox1 = new GraphQLObjectType({
      name: 'NonNullStringBox1',
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) }
      }
    });

    var NonNullStringBox2 = new GraphQLObjectType({
      name: 'NonNullStringBox2',
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) }
      }
    });

    var BoxUnion = new GraphQLUnionType({
      name: 'BoxUnion',
      types: [ StringBox, IntBox, NonNullStringBox1, NonNullStringBox2 ]
    });

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryRoot',
        fields: () => ({
          boxUnion: { type: BoxUnion }
        })
      })
    });

    it('conflicting scalar return types', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
        {
          boxUnion {
            ...on IntBox {
              scalar
            }
            ...on StringBox {
              scalar
            }
          }
        }
      `, [
        { message: fieldsConflictMessage(
            'scalar',
            'they return differing types Int and String'
          ),
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ] }
      ]);
    });

    it('same wrapped scalar return types', () => {
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
        {
          boxUnion {
            ...on NonNullStringBox1 {
              scalar
            }
            ...on NonNullStringBox2 {
              scalar
            }
          }
        }
      `);
    });

  });

});
