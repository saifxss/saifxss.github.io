/**
 * Portfolio Enhancements
 * Typewriter effect, animations, and interactive features
 */

(function() {
    'use strict';

    // Typewriter Effect for Main Title
    function initTypewriter() {
        const typewriterElement = document.getElementById('typewriter-text');
        
        if (typewriterElement && typeof Typewriter !== 'undefined') {
            const typewriter = new Typewriter(typewriterElement, {
                loop: true,
                delay: 75,
                deleteSpeed: 50,
            });

            typewriter
                .typeString('A Game Developer')
                .pauseFor(2000)
                .deleteAll()
                .typeString('A Unity Expert')
                .pauseFor(2000)
                .deleteAll()
                .typeString('A Systems & Tools Developer')
                .pauseFor(2000)
                .deleteAll()
                .typeString('A UI/UX Enthusiast')
                .pauseFor(2000)
                .deleteAll()
                .start();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTypewriter);
    } else {
        initTypewriter();
    }

    // Enhanced Project Card Hover Effects
    function initProjectCardEnhancements() {
        const projectCards = document.querySelectorAll('.folio-list__item');
        
        projectCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.03) translateY(-5px)';
                this.style.transition = 'all 0.3s ease';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1) translateY(0)';
            });
        });
    }

    // Initialize project card enhancements
    setTimeout(initProjectCardEnhancements, 500);

})();
