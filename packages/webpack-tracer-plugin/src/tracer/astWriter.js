function applyInjectionPlan(plan) {
    let modified = false;

    if (!plan.length) {
        return modified;
    }

    const grouped = new Map();
    plan.forEach((insertion) => {
        const key = insertion.container;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(insertion);
    });

    for (const [container, insertions] of grouped.entries()) {
        insertions
            .sort((a, b) => b.index - a.index)
            .forEach((insertion) => {
                container.splice(insertion.index, 0, ...insertion.statements);
                modified = true;
            });
    }

    return modified;
}

module.exports = {
    applyInjectionPlan,
};
