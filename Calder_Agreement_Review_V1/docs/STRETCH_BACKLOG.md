# Deliberately deferred stretch backlog

The following work was started before the sponsor's scope amendment and is intentionally not shipped as required behavior.

## Standard positions and deviation characterization

Stored playbook fields include draft applicability codes, standards, and severity values. They are retained for traceability, but the baseline application does not display or execute them. Before enabling this work, the team must obtain sponsor-approved Calder positions, version them, test deterministic comparisons, and confirm that the classifier only supplies document evidence rather than risk judgments.

## Gap detection

Gap detection is disabled. A failed identification is not proof that a clause is absent: it may reflect extraction, segmentation, retrieval, or model failure. Turning every miss into a confident gap would amplify false negatives into misleading legal workflow alerts.

Before enabling gap detection, the team should require:

1. provision-level recall high enough for the intended use;
2. explicit behavior for unsearchable or partially extracted documents;
3. separate `not detected`, `not reviewed`, and `confirmed absent` states;
4. a human confirmation step; and
5. sponsor-approved rules defining which categories are expected by contract type.

## Activation rule

Stretch features may begin only after the complete baseline is deployed and its intake, manual identification, review queue, disposition, audit, reporting, roles, and evaluation workflows pass acceptance testing.
