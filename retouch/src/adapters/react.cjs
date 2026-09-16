'use strict';
// The React/JSX language adapter (RFC-0001 DR-0015). For now it wraps the
// existing id/stamp/writer modules, which hold the Babel-based implementation;
// the adapter is the seam the core depends on. A future move relocates those
// bodies into this directory, changing nothing outside it.

const path = require('node:path');
const structure = require('../structure.cjs');
const svgMove=require('../jsx-svg-move.cjs'),svgDelete=require('../jsx-svg-delete.cjs'),svgDuplicate=require('../jsx-svg-duplicate.cjs');
function svgPlanner(resolved,op){
 const groups=require('../svg-boolean-group.cjs'),blocked=groups.guard(resolved,op,'react');if(blocked)return {plan:()=>blocked};if(op.type==='scaleGroup')return require('../jsx-group-scale.cjs');if(groups.types.has(op.type))return {plan:(r,o)=>groups.plan(r,o,'react')};
 if(['createSVGMask','releaseSVGMask','setSVGMaskType','setSVGMaskBounds'].includes(op.type))return require('../jsx-svg-mask.cjs');
 if(op.type==='replaceSVGSelection')return {plan:(r,o)=>require('../svg-combine-selection.cjs').plan(r,o,'react')};
 if(op.type==='moveElement'&&svgMove.describe(resolved))return svgMove;
 if(op.type==='deleteElement'&&svgDelete.describe(resolved))return svgDelete;
 if(op.type==='duplicateElement'&&svgDuplicate.describe(resolved))return svgDuplicate;
 return null;
}
const { collectElements, contentHash } = require('../id.cjs');
const { stamp } = require('../stamp.cjs');
const { applyOp, planOp, describeElement } = require('../writer.cjs');

function matches(filePath) {
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return false;
  return /\.(tsx|jsx)$/.test(filePath);
}

module.exports = {
  name: 'react',
  matches,
  stamp,
  collect: collectElements,
  contentHash,
  describe: resolved => {
    const svgDeletion=svgDelete.describe(resolved),svgMovement=svgMove.describe(resolved),svgDuplication=svgDuplicate.describe(resolved);
    const base={...structure.describe(resolved,'react',{scaleChildren:true}),...require('../native-frame-selection.cjs').describe(resolved,'react'),...require('../native-insert.cjs').describe(resolved,'react'),...svgMovement};
    for(const [flag,type]of Object.entries({canReparent:'reparentElement',canFrame:'frameSelection',canRemoveFrame:'removeFrame',canDelete:'deleteElement',canMoveBefore:'moveElement',canMoveAfter:'moveElement',canMoveFirst:'moveElement',canMoveLast:'moveElement'}))if(require('../jsx-group-scale.cjs').guard(resolved,{type}))base[flag]=false;
    if(require('../jsx-group-release.cjs').applies(resolved))base.canRemoveFrame=require('../jsx-group-release.cjs').plan(resolved,{fileHash:resolved.hash}).ok;
    if(require('../jsx-group-regroup.cjs').applies(resolved))Object.assign(base,require('../jsx-group-regroup.cjs').describe(resolved));
    return {...require('../jsx-group-scale.cjs').describe(resolved),svgBooleanGroup:require('../svg-boolean-group.cjs').describe(resolved,'react'),svgBooleanOwner:require('../svg-boolean-group.cjs').owner(resolved,'react'),svgMask:require('../jsx-svg-mask.cjs').describe(resolved),svgBooleanReplacement:require('../svg-combine-selection.cjs').describe(resolved,'react'),componentMovement:resolved.element.kind==='instance'?require('../move-component.cjs').describe(resolved):null,...describeElement(resolved),...require('../jsx-layer-name.cjs').describe(resolved),...require('../jsx-text-styles.cjs').describe(resolved),...require('../jsx-color-styles.cjs').describe(resolved),...require('../jsx-effect-styles.cjs').describe(resolved),...require('../jsx-variable-bindings.cjs').describe(resolved),classSelection:resolved.element.kind==='host',canCreateComponent:resolved.element.kind==='host',canInsertComponent:require('../insert-component.cjs').canContain(resolved),svgDeletion,svgMovement,svgDuplication,context:resolved.context||null,
      structure:svgDeletion?{...base,canDelete:true,canDuplicate:!!svgDuplication||base.canDuplicate,canCopy:base.canDuplicate,canPaste:base.canPaste,parentId:svgDeletion.parentId,reason:base.reason?'SVG structural actions depend on the selected source subtree.':null}:base};
  },
  applyOp: (resolved,op) => {
    const scaled=require('../jsx-group-scale.cjs').guard(resolved,op);if(scaled)return scaled;
    if(op.type==='groupSelection'&&require('../jsx-group-regroup.cjs').applies(resolved))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../jsx-group-regroup.cjs').plan(resolved,op));
    if(op.type==='removeFrame'&&require('../jsx-group-release.cjs').applies(resolved))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../jsx-group-release.cjs').plan(resolved,op));
    if(['frameSelection','groupSelection','removeFrame'].includes(op.type))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../native-frame-selection.cjs').plan(resolved,op,'react'));
    if(['reparentElement','reparentSelection'].includes(op.type))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../native-reparent.cjs').plan(resolved,op,'react'));
    if(['duplicateSelection','deleteSelection','moveSelection'].includes(op.type))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../native-structure-selection.cjs').plan(resolved,op,'react'));
    if(op.type==='insertElement')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../native-insert.cjs').plan(resolved,op,'react'));
    if(op.type==='reparentComponentSelection')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../reparent-component.cjs').planSelection(resolved,op));
    if(op.type==='moveComponent')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../move-component.cjs').plan(resolved,op));
    if(op.type==='renameElement')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../jsx-layer-name.cjs').plan(resolved,op));
    if(['insertComponent','swapComponent'].includes(op.type))return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../insert-component.cjs').plan(resolved,op));
    if(op.type==='setComponentPropSelection')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../component-props.cjs').planSelection(resolved,op));
    if(op.type==='setComponentProp')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../component-props.cjs').plan(resolved,op));
    if(op.type==='deleteComponentSelection')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../delete-component.cjs').planSelection(resolved,op));
    if(op.type==='deleteComponent')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../delete-component.cjs').plan(resolved,op));
    if(op.type==='duplicateComponentSelection')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../duplicate-component.cjs').planSelection(resolved,op));
    if(op.type==='duplicateComponent')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../duplicate-component.cjs').plan(resolved,op));
    if(op.type==='createComponent')return require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),require('../create-component.cjs').plan(resolved,op));
    const svg=svgPlanner(resolved,op);
    return svg||structure.types.has(op.type)?require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),svg?svg.plan(resolved,op):structure.planOp(resolved,op,'react')):applyOp(resolved,op);
  },
  planOp: (resolved,op) => {
    const scaled=require('../jsx-group-scale.cjs').guard(resolved,op);if(scaled)return scaled;
    if(op.type==='groupSelection'&&require('../jsx-group-regroup.cjs').applies(resolved))return require('../jsx-group-regroup.cjs').plan(resolved,op);
    if(op.type==='removeFrame'&&require('../jsx-group-release.cjs').applies(resolved))return require('../jsx-group-release.cjs').plan(resolved,op);
    if(['frameSelection','groupSelection','removeFrame'].includes(op.type))return require('../native-frame-selection.cjs').plan(resolved,op,'react');
    if(['reparentElement','reparentSelection'].includes(op.type))return require('../native-reparent.cjs').plan(resolved,op,'react');
    if(['duplicateSelection','deleteSelection','moveSelection'].includes(op.type))return require('../native-structure-selection.cjs').plan(resolved,op,'react');
    if(op.type==='insertElement')return require('../native-insert.cjs').plan(resolved,op,'react');
    if(op.type==='setComponentPropSelection')return require('../component-props.cjs').planSelection(resolved,op);
    const svg=svgPlanner(resolved,op);
    return op.type==='reparentComponentSelection'?require('../reparent-component.cjs').planSelection(resolved,op):op.type==='moveComponent'?require('../move-component.cjs').plan(resolved,op):op.type==='renameElement'?require('../jsx-layer-name.cjs').plan(resolved,op):['insertComponent','swapComponent'].includes(op.type)?require('../insert-component.cjs').plan(resolved,op):op.type==='setComponentProp'?require('../component-props.cjs').plan(resolved,op):op.type==='deleteComponentSelection'?require('../delete-component.cjs').planSelection(resolved,op):op.type==='deleteComponent'?require('../delete-component.cjs').plan(resolved,op):op.type==='duplicateComponentSelection'?require('../duplicate-component.cjs').planSelection(resolved,op):op.type==='duplicateComponent'?require('../duplicate-component.cjs').plan(resolved,op):op.type==='createComponent'?require('../create-component.cjs').plan(resolved,op):svg?svg.plan(resolved,op):structure.types.has(op.type)?structure.planOp(resolved,op,'react'):op.type==='detachComponent'?require('../components.cjs').planDetach(resolved,op):planOp(resolved,op);
  },
  describeComponent: resolved => require('../components.cjs').describe(resolved),
  hasReference: (root, file, excluded) => require('../components.cjs').hasReference(root, file, excluded),
  assets: { directory: 'public', urlPrefix: '/', uploadDirectory: 'rt-assets' },
  capabilities: {
    classAttr: 'className',
    ops: ['scaleGroup','frameSelection','groupSelection','removeFrame','reparentElement','reparentSelection','duplicateSelection','deleteSelection','moveSelection',...require('../svg-boolean-group.cjs').types,'createSVGMask','releaseSVGMask','setSVGMaskType','setSVGMaskBounds','replaceSVGSelection','setSVGGradient','insertElement','renameElement', 'insertSVG', 'setSVGGeometry','setSVGTransform','setSVGTransforms', 'convertSVGToPath', 'convertSVGToArrow', 'setClasses', 'setClassesSelection', 'setText', 'setChildren', 'setTag', 'setSrc', ...structure.types],
  },
};
