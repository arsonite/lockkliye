/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 */

// React imports
import { useEffect, useState } from 'react';

// Phones, including an iPhone 16 Pro Max (440 CSS pixels wide) in portrait
const QUERY = '(max-width: 768px)';

const useIsMobile = (): boolean => {
    const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);

    useEffect(() => {
        const media = window.matchMedia(QUERY);
        const update = () => setMobile(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    return mobile;
};

export default useIsMobile;
