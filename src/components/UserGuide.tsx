import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, Book, Mic, Settings2, Compass, Heart, Sparkles, Navigation, Monitor } from 'lucide-react';

interface UserGuideProps {
  show: boolean;
  onClose: () => void;
}

export const UserGuide = ({ show, onClose }: UserGuideProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="bg-white dark:bg-[#1c1917] rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-amber-100/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-amber-100 dark:border-amber-900/30 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-2xl shadow-inner">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">دليل المستخدم الشامل</h2>
                  <p className="text-sm text-amber-800/60 dark:text-amber-200/60">كيفية الاستخدام والتحكم في تطبيق القرآن الكريم</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-2xl transition-all text-amber-800 dark:text-amber-200 active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(85vh-100px)] custom-scrollbar text-right" dir="rtl">
              
              {/* Introduction */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                  <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">مرحباً بك في "مداد الرحمن"</h3>
                </div>
                <p className="text-lg leading-relaxed text-amber-950/80 dark:text-amber-100/80 font-vazir">
                  هذا التطبيق ليس مجرد مصحف رقمي، بل هو رفيق ذكي لرحلتك مع كتاب الله. تم تصميمه ليكون "محراباً" إلكترونياً يجمع بين قدسية النص وذكاء التقنية، ليوفر لك تجربة تدبر فريدة وعميقة.
                </p>
                <div className="mt-4 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Sparkles size={16} /> تحديث احترافي:
                  </p>
                  <p className="text-sm text-emerald-900/60 dark:text-emerald-200/60 mt-1">
                    تم تحديث الواجهة لتكون أكثر ديناميكية وانسيابية، مع إضافة سكرولات احترافية وتحسينات بصرية دقيقة تضمن راحة العين وسهولة التنقل.
                  </p>
                </div>
              </section>

              {/* Core Features Grid */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                  <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">الميزات الذكية وكيفية استخدامها</h3>
                </div>
                
                <div className="grid gap-8">
                  {/* AI Assistant - Draggable */}
                  <div className="group bg-gradient-to-br from-amber-500/10 to-orange-600/10 dark:from-amber-500/5 dark:to-orange-600/5 p-8 rounded-[2.5rem] border border-amber-200/50 dark:border-amber-900/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg text-white group-hover:rotate-12 transition-transform">
                        <Sparkles size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-amber-900 dark:text-amber-100 mb-3">المساعد الذكي (AI Hub)</h4>
                        <p className="text-amber-950/70 dark:text-amber-100/70 leading-relaxed text-lg mb-4">
                          بوابتك للتدبر العميق. اسأل عن معاني الآيات، أسباب النزول، أو اطلب تلخيصاً لموضوعات السورة.
                        </p>
                        <div className="bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-amber-200/30 dark:border-amber-900/30">
                          <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <Compass size={16} /> سر ذكي:
                          </p>
                          <p className="text-sm text-amber-900/60 dark:text-amber-200/60 mt-1">
                            يمكنك تحريك زر المساعد في أي مكان على الشاشة! **اضغط عليه مطولاً** ثم اسحبه للموضع الذي يريحك أثناء القراءة.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ayah Context Menu */}
                  <div className="group bg-amber-50/50 dark:bg-amber-900/5 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300">
                    <div className="flex items-start gap-6">
                      <div className="p-4 bg-white dark:bg-amber-900/20 rounded-2xl shadow-sm text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Navigation size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-amber-900 dark:text-amber-200 mb-3">قائمة الخيارات السريعة للآية</h4>
                        <p className="text-amber-950/70 dark:text-amber-100/70 leading-relaxed text-lg">
                          **اضغط مطولاً** على أي آية (أو انقر بزر الفأرة الأيمن) لتظهر لك قائمة سحرية:
                        </p>
                        <ul className="mt-4 space-y-2 text-amber-900/60 dark:text-amber-200/60 list-disc list-inside pr-4">
                          <li>تحليل القراءات العشر المتواترة للآية.</li>
                          <li>الوصول الفوري لتفاسير كبار العلماء (ابن كثير، الطبري، إلخ).</li>
                          <li>طلب تفسير فوري مدعوم بالذكاء الاصطناعي.</li>
                        </ul>
                        <div className="mt-4 bg-emerald-500/10 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            <Book size={16} /> ميزة جديدة:
                          </p>
                          <p className="text-sm text-emerald-900/60 dark:text-emerald-200/60 mt-1">
                            التفاسير تفتح الآن مباشرة في **نافذة المساعد الذكي**! هذا يسمح لك بمتابعة القراءة والرجوع للتفسير في أي وقت دون مغادرة موضعك في السورة.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Noor UI */}
                  <div className="group bg-amber-50/50 dark:bg-amber-900/5 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300">
                    <div className="flex items-start gap-6">
                      <div className="p-4 bg-white dark:bg-amber-900/20 rounded-2xl shadow-sm text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Monitor size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-amber-900 dark:text-amber-200 mb-3">تجربة النور (Noor UI)</h4>
                        <p className="text-amber-950/70 dark:text-amber-100/70 leading-relaxed text-lg">
                          تم تصميم واجهة القراءة "النور" لتكون بؤرة للتركيز والصفاء الذهني. تعتمد على إضاءة هادئة وتصميم يقلل المشتتات، مما يخلق بيئة بصرية مريحة تساعدك على التدبر في آيات الله بوضوح وهدوء.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Octagram */}
                  <div className="group bg-amber-50/50 dark:bg-amber-900/5 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300">
                    <div className="flex items-start gap-6">
                      <div className="p-4 bg-white dark:bg-amber-900/20 rounded-2xl shadow-sm text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Settings2 size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-amber-900 dark:text-amber-200 mb-3">النجمة الثمانية التفاعلية</h4>
                        <p className="text-amber-950/70 dark:text-amber-100/70 leading-relaxed text-lg">
                          في أعلى الصفحة، ستجد نجمة ثمانية مزخرفة بالخط الكوفي. جرب النقر على رؤوس النجمة لتشاهد تأثيرات التوهج والجسيمات السحرية، فهي ليست مجرد زينة بل هي عنصر تفاعلي يربط بين جمال الفن ودقة البرمجة.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Search & Voice */}
                  <div className="group bg-amber-50/50 dark:bg-amber-900/5 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300">
                    <div className="flex items-start gap-6">
                      <div className="p-4 bg-white dark:bg-amber-900/20 rounded-2xl shadow-sm text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Mic size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-amber-900 dark:text-amber-200 mb-3">البحث الصوتي والنصي</h4>
                        <p className="text-amber-950/70 dark:text-amber-100/70 leading-relaxed text-lg">
                          ابحث عن السور أو الآيات بكتابة أسمائها أو أرقامها. كما يمكنك استخدام **البحث الصوتي** بالضغط على أيقونة الميكروفون والتحدث مباشرة، وسيقوم التطبيق بالتعرف على طلبك فوراً.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Tips */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                  <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">نصائح سريعة</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-amber-100/30 dark:bg-amber-900/20 rounded-2xl border border-amber-200/20">
                    <p className="text-amber-900 dark:text-amber-100 font-bold mb-1">تغيير الخط والحجم</p>
                    <p className="text-sm text-amber-900/60 dark:text-amber-200/60">من قائمة الإعدادات، يمكنك اختيار نوع الخط العربي الذي يريح عينك وتعديل حجمه.</p>
                  </div>
                  <div className="p-5 bg-amber-100/30 dark:bg-amber-900/20 rounded-2xl border border-amber-200/20">
                    <p className="text-amber-900 dark:text-amber-100 font-bold mb-1">الوضع الليلي</p>
                    <p className="text-sm text-amber-900/60 dark:text-amber-200/60">استخدم أيقونة الشمس/القمر للتبديل بين الأوضاع البصرية لراحة أكبر أثناء القراءة الليلية.</p>
                  </div>
                  <div className="p-5 bg-amber-100/30 dark:bg-amber-900/20 rounded-2xl border border-amber-200/20">
                    <p className="text-amber-900 dark:text-amber-100 font-bold mb-1">المحفوظات (Bookmarks)</p>
                    <p className="text-sm text-amber-900/60 dark:text-amber-200/60">اضغط على أيقونة النجمة بجانب أي آية لحفظها والرجوع إليها لاحقاً من قسم المحفوظات.</p>
                  </div>
                  <div className="p-5 bg-amber-100/30 dark:bg-amber-900/20 rounded-2xl border border-amber-200/20">
                    <p className="text-amber-900 dark:text-amber-100 font-bold mb-1">مشاركة الآيات</p>
                    <p className="text-sm text-amber-900/60 dark:text-amber-200/60">يمكنك نسخ نص الآية أو مشاركتها مباشرة مع أصدقائك عبر وسائل التواصل الاجتماعي.</p>
                  </div>
                </div>
              </section>

              {/* Footer Quote */}
              <div className="mt-12 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/10 p-10 rounded-[3rem] text-center border-2 border-dashed border-amber-300/50 dark:border-amber-700/50 relative overflow-hidden">
                <div className="absolute -top-10 -left-10 text-amber-200 dark:text-amber-800/20 opacity-30 rotate-12">
                  <Heart size={150} fill="currentColor" />
                </div>
                <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-4 relative z-10 font-quran">
                  "خيركم من تعلم القرآن وعلمه"
                </p>
                <p className="text-amber-800/70 dark:text-amber-200/70 text-lg relative z-10">
                  نسأل الله أن يجعل هذا العمل خالصاً لوجهه الكريم، وأن يكون حجة لنا لا علينا.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
