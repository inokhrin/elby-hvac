(() => {
    const stage = document.querySelector('.pipe-stage');
    const svg = stage.querySelector('.scroll-pipe');
    const paths = [...svg.querySelectorAll('.pipe-run path')];
    const logo = stage.querySelector('.brand img');
    const hero = stage.querySelector('[data-pipe-ports]');
    const heroPorts = hero ? [...hero.querySelectorAll('.hero-pipe-port')]
        .map(element => ({ element, distance: 0 })) : [];
    const destinations = [...stage.querySelectorAll('main .eyebrow')]
        .filter(target => !target.closest('.offers'));
    const startFitting = svg.querySelector('.pipe-start');
    const endFitting = svg.querySelector('.pipe-end');
    const mobileScreen = window.matchMedia('(max-width: 650px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let length = 0;
    let travelLength = 0;
    let initialLength = 0;
    let checkpoints = [];
    let frame = 0;

    // Each intermediate connection draws down and around an elbow before the trunk continues.
    const branches = destinations.slice(0, -1).map(() => {
        const group = document.createElementNS(svg.namespaceURI, 'g');
        group.setAttribute('class', 'pipe-branch');
        const branchPaths = paths.map(path => {
            const copy = path.cloneNode(false);
            group.append(copy);
            return copy;
        });
        const fitting = endFitting.cloneNode(false);
        fitting.setAttribute('class', 'pipe-fitting');
        group.append(fitting);
        svg.querySelector('.pipe-connections').append(group);
        return { paths: branchPaths, fitting, length: 0, startAt: 0, bendAt: 0, travelStart: 0, travelEnd: 0 };
    });

    function draw() {
        if (mobileScreen.matches) return;
        let traveled = travelLength;
        if (!reducedMotion.matches) {
            let previous = { scroll: 0, distance: initialLength };
            for (const next of checkpoints) {
                if (window.scrollY < next.scroll) {
                    const progress = Math.max(0, (window.scrollY - previous.scroll) / (next.scroll - previous.scroll));
                    traveled = previous.distance + progress * (next.distance - previous.distance);
                    break;
                }
                previous = next;
            }
            // Keep the modern starting stub short even when the first section is already in view.
            if (hero && window.scrollY <= 0) traveled = initialLength;
        }
        let revealed = traveled;
        for (const branch of branches) {
            const visible = traveled >= branch.travelEnd
                ? branch.length : Math.max(0, traveled - branch.travelStart);
            if (traveled >= branch.travelStart) {
                revealed = traveled < branch.travelEnd
                    ? branch.startAt + Math.min(visible, branch.bendAt - branch.startAt)
                    : branch.bendAt + traveled - branch.travelEnd;
            }
            for (const path of branch.paths) path.style.strokeDashoffset = branch.length - visible;
            branch.fitting.style.opacity = visible === branch.length ? '1' : '0';
        }
        for (const path of paths) path.style.strokeDashoffset = Math.max(0, length - revealed);
        for (const port of heroPorts) {
            port.element.classList.toggle('is-reached', revealed >= port.distance);
        }
        endFitting.style.opacity = traveled === travelLength ? '1' : '0';
    }

    function measure() {
        if (mobileScreen.matches) return;
        const bounds = stage.getBoundingClientRect();
        const brand = logo.getBoundingClientRect();
        const targets = destinations.map(target => target.getBoundingClientRect());
        const target = targets[targets.length - 1];
        const startX = brand.left - bounds.left + 2;
        const startY = brand.top - bounds.top + brand.height / 2;
        const endX = target.left - bounds.left - 12;
        const endY = target.top - bounds.top + target.height / 2;
        const rail = targets[0].left - bounds.left - 28;
        const radius = 12;
        const route = `M ${startX} ${startY}
            H ${rail + radius}
            Q ${rail} ${startY} ${rail} ${startY + radius}
            V ${endY - radius}
            Q ${rail} ${endY} ${rail + radius} ${endY}
            H ${endX}`;

        svg.setAttribute('width', bounds.width);
        svg.setAttribute('height', endY + 12);
        svg.setAttribute('viewBox', `0 0 ${bounds.width} ${endY + 12}`);
        for (const path of paths) path.setAttribute('d', route);
        length = paths[0].getTotalLength();
        for (const path of paths) path.style.strokeDasharray = `${length} ${length}`;

        // The short vertical approach shares the trunk's position, preserving the existing gutter.
        const inlet = paths[0].cloneNode(false);
        inlet.setAttribute('d', `M ${startX} ${startY} H ${rail + radius}
            Q ${rail} ${startY} ${rail} ${startY + radius}`);
        const inletLength = inlet.getTotalLength();
        const approach = 72;
        let extraTravel = 0;
        branches.forEach((branch, index) => {
            const target = targets[index];
            const x = target.left - bounds.left - 12;
            const y = target.top - bounds.top + target.height / 2;
            const route = `M ${rail} ${y - approach}
                V ${y - radius}
                Q ${rail} ${y} ${rail + radius} ${y}
                H ${x}`;
            for (const path of branch.paths) path.setAttribute('d', route);
            branch.length = branch.paths[0].getTotalLength();
            branch.startAt = inletLength + y - approach - startY - radius;
            branch.bendAt = inletLength + y - startY - radius * 2;
            branch.travelStart = branch.startAt + extraTravel;
            branch.travelEnd = branch.travelStart + branch.length;
            extraTravel = branch.travelEnd - branch.bendAt;
            for (const path of branch.paths) path.style.strokeDasharray = `${branch.length} ${branch.length}`;
            branch.fitting.setAttribute('x', x - 7);
            branch.fitting.setAttribute('y', y - 6.5);
        });
        travelLength = length + extraTravel;

        startFitting.setAttribute('x', startX - 7);
        startFitting.setAttribute('y', startY - 6.5);
        endFitting.setAttribute('x', endX - 7);
        endFitting.setAttribute('y', endY - 6.5);

        // Leave a short connected stub visible before the visitor starts scrolling.
        initialLength = Math.min(length, hero ? 12 : startX - rail + 34);
        if (hero) {
            const panel = hero.getBoundingClientRect();
            hero.style.setProperty('--pipe-port-left', `${rail - panel.left + bounds.left}px`);
            for (const port of heroPorts) {
                const edge = port.element.classList.contains('hero-pipe-port--bottom') ? panel.bottom : panel.top;
                port.distance = inletLength + edge - bounds.top - startY - radius;
            }
            hero.setAttribute('data-pipe-ready', '');
        }
        const stageTop = bounds.top + window.scrollY;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight - 1);
        checkpoints = [];
        targets.forEach((target, index) => {
            const finish = Math.min(maxScroll, Math.max(1,
                stageTop + target.top - bounds.top + target.height / 2 - window.innerHeight * 0.62));
            const branch = branches[index];
            if (branch) {
                // Give each elbow its own scroll interval instead of a near-instant side branch.
                const previousScroll = checkpoints.length ? checkpoints[checkpoints.length - 1].scroll : 0;
                checkpoints.push({
                    scroll: Math.max(previousScroll, finish - 120),
                    distance: branch.travelStart
                });
                checkpoints.push({ scroll: finish, distance: branch.travelEnd });
            } else {
                checkpoints.push({ scroll: finish, distance: travelLength });
            }
        });
        draw();
        svg.setAttribute('data-ready', '');
    }

    function scheduleDraw() {
        if (mobileScreen.matches || frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            draw();
        });
    }

    window.addEventListener('scroll', scheduleDraw, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('pageshow', measure);
    reducedMotion.addEventListener('change', draw);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stage);
    resizeObserver.observe(logo);
    document.fonts.ready.then(measure);
    measure();
})();
