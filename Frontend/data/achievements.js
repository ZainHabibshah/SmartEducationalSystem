// Achievements data structure
// 5 Easy, 10 Medium, 5 Hard achievements

export const ACHIEVEMENTS = [
  // ========== EASY ACHIEVEMENTS (5) ==========
  {
    id: 'first_quiz',
    name: 'First Steps',
    icon: 'rocket',
    iconLibrary: 'Ionicons',
    color: '#4CAF50',
    difficulty: 'easy',
    description: 'Complete your first quiz',
    tasks: [
      'Take and complete any quiz',
      'Submit your answers',
      'Get your first score'
    ],
    checkFunction: 'checkFirstQuiz'
  },
  {
    id: 'perfect_score_easy',
    name: 'Perfect Start',
    icon: 'star',
    iconLibrary: 'Ionicons',
    color: '#FFD700',
    difficulty: 'easy',
    description: 'Score 10/10 on an easy difficulty quiz',
    tasks: [
      'Take a quiz with easy difficulty',
      'Answer all 10 questions correctly',
      'Achieve 100% score'
    ],
    checkFunction: 'checkPerfectScoreEasy'
  },
  {
    id: 'three_quizzes',
    name: 'Getting Started',
    icon: 'checkmark-circle',
    iconLibrary: 'Ionicons',
    color: '#2196F3',
    difficulty: 'easy',
    description: 'Complete 3 quizzes',
    tasks: [
      'Take and complete 3 different quizzes',
      'Submit all quiz answers',
      'Build your quiz history'
    ],
    checkFunction: 'checkThreeQuizzes'
  },
  {
    id: 'fast_learner',
    name: 'Speed Demon',
    icon: 'flash',
    iconLibrary: 'Ionicons',
    color: '#FF9800',
    difficulty: 'easy',
    description: 'Complete a quiz in under 5 minutes',
    tasks: [
      'Take any quiz',
      'Complete it in less than 5 minutes',
      'Submit before time runs out'
    ],
    checkFunction: 'checkFastLearner'
  },
  {
    id: 'consistent_easy',
    name: 'Steady Progress',
    icon: 'trending-up',
    iconLibrary: 'Ionicons',
    color: '#9C27B0',
    difficulty: 'easy',
    description: 'Score 80% or above on 2 easy quizzes',
    tasks: [
      'Take 2 quizzes with easy difficulty',
      'Score 80% or higher on both',
      'Maintain consistent performance'
    ],
    checkFunction: 'checkConsistentEasy'
  },

  // ========== MEDIUM ACHIEVEMENTS (10) ==========
  {
    id: 'medium_master',
    name: 'Medium Master',
    icon: 'trophy',
    iconLibrary: 'Ionicons',
    color: '#E91E63',
    difficulty: 'medium',
    description: 'Score 10/10 on a medium difficulty quiz',
    tasks: [
      'Take a quiz with medium difficulty',
      'Answer all 10 questions correctly',
      'Achieve perfect score on medium level'
    ],
    checkFunction: 'checkMediumMaster'
  },
  {
    id: 'five_medium',
    name: 'Medium Explorer',
    icon: 'compass',
    iconLibrary: 'Ionicons',
    color: '#00BCD4',
    difficulty: 'medium',
    description: 'Complete 5 medium difficulty quizzes',
    tasks: [
      'Take 5 different quizzes with medium difficulty',
      'Complete and submit all of them',
      'Explore various topics at medium level'
    ],
    checkFunction: 'checkFiveMedium'
  },
  {
    id: 'two_perfect_medium',
    name: 'Double Perfect',
    icon: 'diamond',
    iconLibrary: 'Ionicons',
    color: '#FF5722',
    difficulty: 'medium',
    description: 'Score 10/10 on 2 medium difficulty quizzes',
    tasks: [
      'Take 2 quizzes with medium difficulty',
      'Score 10/10 on both quizzes',
      'Maintain perfect performance'
    ],
    checkFunction: 'checkTwoPerfectMedium'
  },
  {
    id: 'different_topics',
    name: 'Topic Explorer',
    icon: 'library',
    iconLibrary: 'Ionicons',
    color: '#3F51B5',
    difficulty: 'medium',
    description: 'Complete quizzes on 5 different topics',
    tasks: [
      'Take quizzes covering 5 different topics',
      'Each topic must be unique',
      'Complete all quizzes successfully'
    ],
    checkFunction: 'checkDifferentTopics'
  },
  {
    id: 'medium_80_plus',
    name: 'Consistent Achiever',
    icon: 'medal',
    iconLibrary: 'Ionicons',
    color: '#FFC107',
    difficulty: 'medium',
    description: 'Score 80% or above on 3 medium quizzes',
    tasks: [
      'Take 3 quizzes with medium difficulty',
      'Score 80% or higher on all three',
      'Show consistent strong performance'
    ],
    checkFunction: 'checkMedium80Plus'
  },
  {
    id: 'ten_quizzes',
    name: 'Quiz Veteran',
    icon: 'shield',
    iconLibrary: 'Ionicons',
    color: '#8BC34A',
    difficulty: 'medium',
    description: 'Complete 10 quizzes total',
    tasks: [
      'Take and complete 10 different quizzes',
      'Submit all quiz answers',
      'Build extensive quiz experience'
    ],
    checkFunction: 'checkTenQuizzes'
  },
  {
    id: 'three_topics_medium',
    name: 'Multi-Topic Expert',
    icon: 'book',
    iconLibrary: 'Ionicons',
    color: '#795548',
    difficulty: 'medium',
    description: 'Score 90%+ on medium quizzes in 3 different topics',
    tasks: [
      'Take medium difficulty quizzes on 3 different topics',
      'Score 90% or higher on each',
      'Demonstrate expertise across topics'
    ],
    checkFunction: 'checkThreeTopicsMedium'
  },
  {
    id: 'streak_three',
    name: 'On a Roll',
    icon: 'flame',
    iconLibrary: 'Ionicons',
    color: '#F44336',
    difficulty: 'medium',
    description: 'Score 85%+ on 3 consecutive quizzes',
    tasks: [
      'Take 3 quizzes in a row',
      'Score 85% or higher on each consecutive quiz',
      'Maintain a winning streak'
    ],
    checkFunction: 'checkStreakThree'
  },
  {
    id: 'quick_medium',
    name: 'Quick Thinker',
    icon: 'time',
    iconLibrary: 'Ionicons',
    color: '#009688',
    difficulty: 'medium',
    description: 'Complete 3 medium quizzes in under 4 minutes each',
    tasks: [
      'Take 3 medium difficulty quizzes',
      'Complete each in less than 4 minutes',
      'Show speed and accuracy'
    ],
    checkFunction: 'checkQuickMedium'
  },
  {
    id: 'balanced_performer',
    name: 'Balanced Scholar',
    icon: 'balance',
    iconLibrary: 'Ionicons',
    color: '#673AB7',
    difficulty: 'medium',
    description: 'Score 75%+ on quizzes in 4 different topics',
    tasks: [
      'Take quizzes on 4 different topics',
      'Score 75% or higher on each',
      'Show balanced knowledge across subjects'
    ],
    checkFunction: 'checkBalancedPerformer'
  },

  // ========== HARD ACHIEVEMENTS (5) ==========
  {
    id: 'hard_perfect',
    name: 'Hard Mode Champion',
    icon: 'crown',
    iconLibrary: 'Ionicons',
    color: '#FF6B35',
    difficulty: 'hard',
    description: 'Score 10/10 on a hard difficulty quiz',
    tasks: [
      'Take a quiz with hard difficulty',
      'Answer all 10 questions correctly',
      'Achieve perfect score on the hardest level'
    ],
    checkFunction: 'checkHardPerfect'
  },
  {
    id: 'two_hard_perfect',
    name: 'Elite Performer',
    icon: 'star-circle',
    iconLibrary: 'Ionicons',
    color: '#E91E63',
    difficulty: 'hard',
    description: 'Score 10/10 on 2 hard difficulty quizzes with different topics',
    tasks: [
      'Take 2 hard difficulty quizzes',
      'Each quiz must be on a different topic',
      'Score 10/10 on both quizzes',
      'Prove mastery across multiple hard topics'
    ],
    checkFunction: 'checkTwoHardPerfect'
  },
  {
    id: 'five_hard',
    name: 'Hard Mode Veteran',
    icon: 'skull',
    iconLibrary: 'Ionicons',
    color: '#424242',
    difficulty: 'hard',
    description: 'Complete 5 hard difficulty quizzes',
    tasks: [
      'Take and complete 5 different hard difficulty quizzes',
      'Submit all quiz answers',
      'Persevere through challenging content'
    ],
    checkFunction: 'checkFiveHard'
  },
  {
    id: 'hard_streak',
    name: 'Unstoppable',
    icon: 'thunderstorm',
    iconLibrary: 'Ionicons',
    color: '#9C27B0',
    difficulty: 'hard',
    description: 'Score 90%+ on 3 consecutive hard quizzes',
    tasks: [
      'Take 3 hard difficulty quizzes in a row',
      'Score 90% or higher on each consecutive quiz',
      'Maintain excellence under pressure'
    ],
    checkFunction: 'checkHardStreak'
  },
  {
    id: 'ultimate_master',
    name: 'Ultimate Master',
    icon: 'trophy-outline',
    iconLibrary: 'Ionicons',
    color: '#FFD700',
    difficulty: 'hard',
    description: 'Score 95%+ on 5 hard quizzes across 5 different topics',
    tasks: [
      'Take 5 hard difficulty quizzes',
      'Each quiz must be on a different topic',
      'Score 95% or higher on all 5 quizzes',
      'Demonstrate ultimate mastery across all subjects'
    ],
    checkFunction: 'checkUltimateMaster'
  }
];

// Helper function to get achievement by ID
export const getAchievementById = (id) => {
  return ACHIEVEMENTS.find(achievement => achievement.id === id);
};

// Helper function to get achievements by difficulty
export const getAchievementsByDifficulty = (difficulty) => {
  return ACHIEVEMENTS.filter(achievement => achievement.difficulty === difficulty);
};
