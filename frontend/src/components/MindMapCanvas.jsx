import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

const MindMapCanvas = ({
    mindMapData,
    expandedNodes,
    onNodeToggle,
    onNodeClick,
    isDark,
    zoom,
    setZoom,
    pan,
    setPan,
    conversationId,
    isFullscreen,
    onExitFullscreen
}) => {
    const containerRef = useRef(null);
    const panRef = useRef(pan);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

    // Keep panRef in sync
    useEffect(() => { panRef.current = pan; }, [pan]);

    // Track nodes that just appeared (for animation)
    const [newlyVisibleNodes, setNewlyVisibleNodes] = useState({});
    const prevVisibleNodesRef = useRef(new Set());

    // Update container size on resize
    useEffect(() => {
        const updateSize = () => {
            if (isFullscreen) {
                setContainerSize({ width: window.innerWidth, height: window.innerHeight });
            } else if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [isFullscreen]);

    // Layout constants
    const NODE_HEIGHT = 36;
    const NODE_PADDING_X = 14;
    const NODE_PADDING_Y = 18;
    const LEVEL_SPACING = 180;
    const ARROW_SIZE = 24;
    const ARROW_GAP = 6;

    // Calculate node width - Increased avgCharWidth to prevent line origin issues
    const getNodeWidth = (text) => {
        const avgCharWidth = 8.5; // Increased from 7.2 to safe-guard wide fonts
        const textWidth = text.length * avgCharWidth;
        return Math.max(90, textWidth + NODE_PADDING_X * 2);
    };

    // Calculate tree layout
    const calculateTreeLayout = useCallback(() => {
        if (!mindMapData || !mindMapData.nodes) return { nodes: [], connections: [], nodePositions: {} };

        const allNodes = [];
        const allConnections = [];
        const nodePositions = {};

        // Calculate subtree height
        const calculateSubtreeHeight = (node, level = 1) => {
            if (!node) return NODE_HEIGHT + NODE_PADDING_Y;

            const isExpanded = level === 0 || expandedNodes[node.id];
            const children = node.children || (level === 0 ? mindMapData.nodes : []);

            if (!isExpanded || !children || children.length === 0) {
                return NODE_HEIGHT + NODE_PADDING_Y;
            }

            let totalHeight = 0;
            children.forEach(child => {
                totalHeight += calculateSubtreeHeight(child, level + 1);
            });

            return Math.max(NODE_HEIGHT + NODE_PADDING_Y, totalHeight);
        };

        // Root position
        const rootWidth = getNodeWidth(mindMapData.title || 'Document');
        const rootX = 80;
        const rootY = containerSize.height / 2;

        const rootHasChildren = mindMapData.nodes && mindMapData.nodes.length > 0;
        const rootIsExpanded = expandedNodes['root'] !== false;
        const rootLineOriginX = rootX + rootWidth + ARROW_GAP + (rootHasChildren ? ARROW_SIZE / 2 : 8);

        nodePositions['root'] = { x: rootX, y: rootY, lineOriginX: rootLineOriginX };

        allNodes.push({
            id: 'root',
            label: mindMapData.title || 'Document',
            x: rootX,
            y: rootY,
            width: rootWidth,
            level: 0,
            isRoot: true,
            hasChildren: rootHasChildren,
            isExpanded: rootIsExpanded,
            lineOriginX: rootLineOriginX,
            lineOriginY: rootY,
            parentId: null
        });

        // Process children
        const processChildren = (children, parentLineOriginX, parentLineOriginY, parentId, level, parentOffsetY) => {
            if (!children || children.length === 0) return;

            const childHeights = children.map(child => calculateSubtreeHeight(child, level));
            const totalChildrenHeight = childHeights.reduce((sum, h) => sum + h, 0);

            let currentY = parentOffsetY - totalChildrenHeight / 2;

            children.forEach((child, index) => {
                const childHeight = childHeights[index];
                const childY = currentY + childHeight / 2;
                const childWidth = getNodeWidth(child.label);
                const childX = parentLineOriginX + LEVEL_SPACING - 40;

                const hasChildren = child.children && child.children.length > 0;
                const isExpanded = expandedNodes[child.id];
                const arrowCenterX = childX + childWidth + ARROW_GAP + ARROW_SIZE / 2;

                // Store parent position for animation origin
                const parentPos = nodePositions[parentId];

                nodePositions[child.id] = {
                    x: childX,
                    y: childY,
                    lineOriginX: arrowCenterX,
                    parentX: parentPos?.lineOriginX || parentLineOriginX,
                    parentY: parentPos?.y || parentLineOriginY
                };

                allNodes.push({
                    id: child.id,
                    label: child.label,
                    x: childX,
                    y: childY,
                    width: childWidth,
                    level,
                    hasChildren,
                    isExpanded,
                    parentId,
                    lineOriginX: arrowCenterX,
                    lineOriginY: childY,
                    // Animation: start position (at parent's arrow)
                    startX: parentPos?.lineOriginX || parentLineOriginX,
                    startY: parentPos?.y || parentLineOriginY
                });

                allConnections.push({
                    id: `conn-${parentId}-${child.id}`,
                    fromX: parentLineOriginX,
                    fromY: parentLineOriginY,
                    toX: childX,
                    toY: childY,
                    level,
                    parentId,
                    childId: child.id,
                    // For animation: start path depends on parent
                    startFromX: parentLineOriginX,
                    startFromY: parentLineOriginY,
                    startToX: parentLineOriginX, // Initially line goes to parent (zero length)
                    startToY: parentLineOriginY
                });

                // Only process if THIS node is expanded (immediate children only)
                if (isExpanded && hasChildren) {
                    processChildren(child.children, arrowCenterX, childY, child.id, level + 1, childY);
                }

                currentY += childHeight;
            });
        };

        if (rootIsExpanded && mindMapData.nodes && mindMapData.nodes.length > 0) {
            processChildren(mindMapData.nodes, rootLineOriginX, rootY, 'root', 1, rootY);
        }

        return { nodes: allNodes, connections: allConnections, nodePositions };
    }, [mindMapData, expandedNodes, containerSize.height]);

    const { nodes, connections, nodePositions } = useMemo(() => calculateTreeLayout(), [calculateTreeLayout]);

    // Detect newly visible nodes for animation
    useEffect(() => {
        const currentVisibleIds = new Set(nodes.map(n => n.id));
        const prevVisibleIds = prevVisibleNodesRef.current;

        // Build lookup map for O(1) node access
        const nodesById = new Map(nodes.map(n => [n.id, n]));

        const newNodes = {};
        let hasNew = false;
        currentVisibleIds.forEach(id => {
            if (!prevVisibleIds.has(id) && id !== 'root') {
                const node = nodesById.get(id);
                if (node) {
                    hasNew = true;
                    newNodes[id] = {
                        startX: node.startX,
                        startY: node.startY,
                        endX: node.x,
                        endY: node.y
                    };
                }
            }
        });

        let raf1 = null;
        let raf2 = null;

        if (hasNew) {
            setNewlyVisibleNodes(newNodes);
            // Clear immediately to trigger transition
            // We use requestAnimationFrame to ensure the 'start' state renders first
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    setNewlyVisibleNodes({});
                });
            });
        }

        prevVisibleNodesRef.current = currentVisibleIds;

        // Cleanup function to cancel pending RAFs
        return () => {
            if (raf1 !== null) cancelAnimationFrame(raf1);
            if (raf2 !== null) cancelAnimationFrame(raf2);
        };
    }, [nodes]);

    // Pan handlers
    // Pan handlers with limits
    const handleMouseDown = (e) => {
        if (e.target.closest('.mindmap-node-label') || e.target.closest('.mindmap-arrow')) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e) => {
        if (isPanning) {
            let newX = e.clientX - panStart.x;
            let newY = e.clientY - panStart.y;

            // Calculate content-aware boundaries based on node positions
            if (nodes.length > 0) {
                // Compute world content bounds from nodes
                const worldMinX = Math.min(...nodes.map(n => n.x));
                const worldMaxX = Math.max(...nodes.map(n => n.x + n.width));
                const worldMinY = Math.min(...nodes.map(n => n.y));
                const worldMaxY = Math.max(...nodes.map(n => n.y + NODE_HEIGHT));

                // Content dimensions in world space
                const contentWidth = worldMaxX - worldMinX;
                const contentHeight = worldMaxY - worldMinY;

                // Padding to keep some content visible at edges
                const edgePadding = 100;

                // Pan limits: ensure at least edgePadding of content stays visible
                // When pan is at maxPanX, the left edge of content is at right edge of viewport
                const maxPanX = containerSize.width - (worldMinX * zoom) - edgePadding;
                // When pan is at minPanX, the right edge of content is at left edge of viewport
                const minPanX = -(worldMaxX * zoom) + edgePadding;
                // Similarly for Y
                const maxPanY = containerSize.height - (worldMinY * zoom) - edgePadding;
                const minPanY = -(worldMaxY * zoom) + edgePadding;

                newX = Math.max(minPanX, Math.min(maxPanX, newX));
                newY = Math.max(minPanY, Math.min(maxPanY, newY));
            }

            const newPan = { x: newX, y: newY };
            panRef.current = newPan;
            setPan(newPan);
        }
    };

    const handleMouseUp = () => {
        if (isPanning) {
            localStorage.setItem(`mindmap_pan_${conversationId}`, JSON.stringify(panRef.current));
        }
        setIsPanning(false);
    };

    // Zoom handler for native event
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoom(prevZoom => {
            const newZoom = Math.max(0.25, Math.min(2.5, prevZoom + delta));
            localStorage.setItem(`mindmap_zoom_${conversationId}`, JSON.stringify(newZoom));
            return newZoom;
        });
    }, [conversationId, setZoom]);

    // Use native event listener for wheel to avoid passive listener issue
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleZoomIn = () => {
        const newZoom = Math.min(2.5, zoom + 0.12);
        setZoom(newZoom);
        localStorage.setItem(`mindmap_zoom_${conversationId}`, JSON.stringify(newZoom));
    };

    const handleZoomOut = () => {
        const newZoom = Math.max(0.25, zoom - 0.12);
        setZoom(newZoom);
        localStorage.setItem(`mindmap_zoom_${conversationId}`, JSON.stringify(newZoom));
    };

    const handleReset = () => {
        setZoom(0.85);
        setPan({ x: 0, y: 0 });
        localStorage.setItem(`mindmap_zoom_${conversationId}`, JSON.stringify(0.85));
        localStorage.setItem(`mindmap_pan_${conversationId}`, JSON.stringify({ x: 0, y: 0 }));
    };

    // Node styles
    const getNodeStyle = () => {
        return {
            background: isDark ? 'rgba(45, 55, 72, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            border: isDark ? '1px solid rgba(100, 116, 139, 0.5)' : '1px solid rgba(203, 213, 225, 0.8)',
            color: isDark ? '#e2e8f0' : '#1e293b',
            boxShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.25)'
                : '0 2px 8px rgba(0, 0, 0, 0.06)'
        };
    };

    // Smooth curved path
    const createCurvedPath = (fromX, fromY, toX, toY) => {
        const controlOffset = (toX - fromX) * 0.45;
        return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
    };

    const lineColor = isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.65)';
    const bgColor = isDark
        ? 'linear-gradient(180deg, #1a1b1e 0%, #0f0f10 100%)'
        : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)';

    const fullscreenStyle = isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        padding: 0,
        margin: 0,
        borderRadius: 0
    } : {};

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{
                width: '100%',
                height: isFullscreen ? '100vh' : '100%',
                minHeight: isFullscreen ? '100vh' : '500px',
                background: bgColor,
                ...fullscreenStyle
            }}
        >
            {/* Exit Fullscreen Button */}
            {isFullscreen && onExitFullscreen && (
                <button
                    onClick={onExitFullscreen}
                    className={`absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${isDark
                        ? 'border-white/10 bg-gray-900/95 hover:bg-gray-800 text-gray-300'
                        : 'border-gray-200 bg-white/95 hover:bg-gray-50 text-gray-600'
                        } shadow-lg backdrop-blur-sm`}
                    title="Exit fullscreen"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                    <span className="text-sm font-medium">Exit Fullscreen</span>
                </button>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-50" style={{ pointerEvents: 'auto' }}>
                <button
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    title="Zoom in"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${isDark
                        ? 'border-white/10 bg-gray-900/90 hover:bg-gray-800 text-gray-300'
                        : 'border-gray-200 bg-white/95 hover:bg-gray-50 text-gray-600'
                        } shadow-lg backdrop-blur-sm`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
                <button
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    title="Zoom out"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${isDark
                        ? 'border-white/10 bg-gray-900/90 hover:bg-gray-800 text-gray-300'
                        : 'border-gray-200 bg-white/95 hover:bg-gray-50 text-gray-600'
                        } shadow-lg backdrop-blur-sm`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14" />
                    </svg>
                </button>
                <button
                    onClick={handleReset}
                    aria-label="Reset view"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${isDark
                        ? 'border-white/10 bg-gray-900/90 hover:bg-gray-800 text-gray-300'
                        : 'border-gray-200 bg-white/95 hover:bg-gray-50 text-gray-600'
                        } shadow-lg backdrop-blur-sm`}
                    title="Reset view"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </button>
            </div>

            {/* Canvas */}
            <div
                className={`w-full h-full select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    {/* SVG for lines */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'visible',
                            pointerEvents: 'none'
                        }}
                    >
                        {connections.map((conn) => {
                            const isNew = newlyVisibleNodes[conn.childId];
                            // If new, start line from Parent to Parent (collapsed)
                            // If not new, line is Parent to Child (expanded)

                            // Use stroke-dasharray animation for "drawing" effect
                            // The `d` attribute cannot be animated via CSS

                            const pathD = createCurvedPath(conn.fromX, conn.fromY, conn.toX, conn.toY);
                            // Estimate path length (rough approximation for cubic bezier)
                            const dx = conn.toX - conn.fromX;
                            const dy = conn.toY - conn.fromY;
                            const pathLength = Math.sqrt(dx * dx + dy * dy) * 1.2;

                            return (
                                <path
                                    key={conn.id}
                                    d={pathD}
                                    fill="none"
                                    stroke={lineColor}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    style={{
                                        // Use stroke-dasharray/dashoffset for draw-in animation
                                        strokeDasharray: pathLength,
                                        strokeDashoffset: isNew ? pathLength : 0,
                                        transition: 'stroke-dashoffset 1s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease',
                                        opacity: 1
                                    }}
                                />
                            );
                        })}
                    </svg>

                    {/* Nodes */}
                    {nodes.map((node) => {
                        const style = getNodeStyle();
                        const animData = newlyVisibleNodes[node.id];

                        // If new, lock position to Parent (startX/startY)
                        // If not new, position is Normal (x/y)
                        // CSS transition handles the movement between states

                        const currentX = animData ? animData.startX : node.x;
                        const currentY = animData ? animData.startY : node.y;
                        const currentScale = animData ? 0.3 : 1;
                        const currentOpacity = animData ? 0 : 1;

                        return (
                            <div
                                key={node.id}
                                className="absolute flex items-center"
                                style={{
                                    left: currentX,
                                    top: currentY,
                                    transform: `translateY(-50%) scale(${currentScale})`,
                                    opacity: currentOpacity,
                                    // Transition all properties for smooth expansion
                                    transition: isPanning
                                        ? 'none'
                                        : 'left 1s cubic-bezier(0.19, 1, 0.22, 1), top 1s cubic-bezier(0.19, 1, 0.22, 1), transform 1s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.5s ease',
                                    zIndex: node.isRoot ? 10 : 5
                                }}
                            >
                                {/* Node Label */}
                                <div
                                    className="mindmap-node-label flex items-center justify-center rounded-xl cursor-pointer transition-shadow duration-200 hover:shadow-lg"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Query: ${node.label}`}
                                    style={{
                                        height: NODE_HEIGHT,
                                        padding: `0 ${NODE_PADDING_X}px`,
                                        whiteSpace: 'nowrap',
                                        overflow: 'visible',
                                        background: style.background,
                                        border: style.border,
                                        boxShadow: style.boxShadow
                                    }}
                                    onClick={() => onNodeClick(node.label)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onNodeClick(node.label);
                                        }
                                    }}
                                    title={`Click to query: "${node.label}"`}
                                >
                                    <span className="text-sm font-medium" style={{ color: style.color }}>
                                        {node.label}
                                    </span>
                                </div>

                                {/* Arrow Button */}
                                {node.hasChildren && (
                                    <button
                                        className="mindmap-arrow flex items-center justify-center transition-all duration-200 hover:scale-105"
                                        aria-label={node.isExpanded ? 'Collapse node' : 'Expand node'}
                                        aria-expanded={node.isExpanded}
                                        style={{
                                            width: ARROW_SIZE,
                                            height: ARROW_SIZE,
                                            marginLeft: ARROW_GAP,
                                            borderRadius: 8,
                                            background: isDark ? 'rgba(45, 55, 72, 0.9)' : 'rgba(241, 245, 249, 0.95)',
                                            border: isDark ? '1px solid rgba(100, 116, 139, 0.5)' : '1px solid rgba(203, 213, 225, 0.8)',
                                            color: isDark ? '#94a3b8' : '#64748b',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            boxShadow: isDark
                                                ? '0 2px 4px rgba(0, 0, 0, 0.2)'
                                                : '0 1px 3px rgba(0, 0, 0, 0.08)'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNodeToggle(node.id);
                                        }}
                                        title={node.isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
                                            {node.isExpanded ? '<' : '>'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MindMapCanvas;
