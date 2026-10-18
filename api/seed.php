<?php
/* ==========================================================================
   CSAP-COC  |  Default content (single source of truth)
   Used by api/install.php to seed the database and by the API as a fallback
   so the site renders even before the database is populated.
   ========================================================================== */
declare(strict_types=1);

/* ------------------------------------------------------------------ settings */
function csap_setting_defaults(): array
{
    return [
        'site_title'      => ['label' => 'Site title',        'group' => 'branding', 'type' => 'text',  'value' => "CSAP-COC | City Scholars' Association in PHINMA Cagayan de Oro College", 'sort' => 1],
        'site_short'      => ['label' => 'Short name',        'group' => 'branding', 'type' => 'text',  'value' => 'CSAP-COC', 'sort' => 2],
        'org_name'        => ['label' => 'Organization name', 'group' => 'branding', 'type' => 'text',  'value' => "City Scholars' Association in PHINMA Cagayan de Oro College", 'sort' => 3],
        'site_tagline'    => ['label' => 'Tagline',           'group' => 'branding', 'type' => 'text',  'value' => '“To Serve and Guide the Oro Scholars in PHINMA COC.”', 'sort' => 4],
        'site_established'=> ['label' => 'Established',       'group' => 'branding', 'type' => 'text',  'value' => 'Est. 2019', 'sort' => 5],
        'meta_description'=> ['label' => 'Meta description',  'group' => 'branding', 'type' => 'textarea', 'value' => "The City Scholars' Association in PHINMA Cagayan de Oro College (CSAP-COC) - To Serve and Guide the Oro Scholars in PHINMA COC. Est. 2019.", 'sort' => 6],
        'logo'            => ['label' => 'Logo (512px)',      'group' => 'branding', 'type' => 'image', 'value' => 'assets/images/logo-512.png', 'sort' => 7],
        'logo_small'      => ['label' => 'Favicon / small logo', 'group' => 'branding', 'type' => 'image', 'value' => 'assets/images/logo-128.png', 'sort' => 8],
        'theme_color'     => ['label' => 'Theme colour',      'group' => 'branding', 'type' => 'color', 'value' => '#274e13', 'sort' => 9],

        'color_primary'   => ['label' => 'Primary (green)',   'group' => 'colours',  'type' => 'color', 'value' => '#274e13', 'sort' => 1],
        'color_accent'    => ['label' => 'Accent (yellow)',    'group' => 'colours',  'type' => 'color', 'value' => '#ffd400', 'sort' => 2],
        'color_bg'        => ['label' => 'Page background',    'group' => 'colours',  'type' => 'color', 'value' => '#f7faf3', 'sort' => 3],

        'contact_email'   => ['label' => 'CSAP-COC email',    'group' => 'contact',  'type' => 'text',  'value' => 'coccsap@gmail.com', 'sort' => 1],
        'contact_email_2' => ['label' => 'Palayaw email',     'group' => 'contact',  'type' => 'text',  'value' => 'palayawcsapcoc@gmail.com', 'sort' => 2],
        'facebook_1'      => ['label' => 'Facebook — CSAP-COC',   'group' => 'contact', 'type' => 'url', 'value' => 'https://www.facebook.com/csapcoc', 'sort' => 3],
        'facebook_2'      => ['label' => 'Facebook — PHINMA-COC', 'group' => 'contact', 'type' => 'url', 'value' => 'https://www.facebook.com/phinmacoc', 'sort' => 4],
        'facebook_3'      => ['label' => 'Facebook — City Scholarships Office', 'group' => 'contact', 'type' => 'url', 'value' => 'https://www.facebook.com/CDOCityScholarshipsOffice/', 'sort' => 5],

        'footer_about'    => ['label' => 'Footer about text', 'group' => 'footer', 'type' => 'textarea', 'value' => "City Scholars' Association in PHINMA Cagayan de Oro College.", 'sort' => 1],
        'footer_credit'   => ['label' => 'Footer credit',     'group' => 'footer', 'type' => 'text',  'value' => 'Designed and Developed by ISDA DEVS of PHINMA-COC', 'sort' => 2],
        'footer_copy'     => ['label' => 'Copyright line',    'group' => 'footer', 'type' => 'text',  'value' => '© 2026 CSAP-COC. All Rights Reserved.', 'sort' => 3],

        'calendar_src'    => ['label' => 'Calendar iframe URL', 'group' => 'general', 'type' => 'url',  'value' => 'https://www.google.com/calendar/embed?color=%239fe1e7&mode=MONTH&showCalendars=1&showPrint=0&showTz=0&src=coccsap@gmail.com', 'sort' => 1],
        'inquiry_text'    => ['label' => 'Inquiry line',      'group' => 'general', 'type' => 'text',  'value' => 'For inquiries on our forms and other requirements, please send us a message on Facebook:', 'sort' => 2],
    ];
}

/* ------------------------------------------------------------ content blocks */
function csap_block_defaults(): array
{
    $B = static function (string $label, string $type, string $value): array {
        return ['label' => $label, 'type' => $type, 'value' => $value];
    };

    return [
        'hero' => [
            'eyebrow'    => $B('Eyebrow', 'text', 'Welcome'),
            'title'      => $B('Title', 'text', 'WELCOME, ISDA!'),
            'tagline'    => $B('Tagline', 'text', '“To Serve and Guide the Oro Scholars in PHINMA COC.”'),
            'meta'       => $B('Meta line', 'text', 'Est. 2019'),
            'logo'       => $B('Hero logo', 'image', 'assets/images/logo-512.png'),
            'btn1_label' => $B('Button 1 label', 'text', 'Learn More'),
            'btn1_url'   => $B('Button 1 link', 'text', '#city-scholarship'),
            'btn2_label' => $B('Button 2 label', 'text', 'Enroll Now'),
            'btn2_url'   => $B('Button 2 link', 'text', '#enrollment'),
            'bg_slides'  => $B('Background slides', 'images', "assets/images/hero-1.jpg\nassets/images/hero-2.jpg\nassets/images/hero-3.jpg"),
            'gallery'    => $B('Highlight gallery', 'images', "assets/images/hero-1.jpg\nassets/images/hero-2.jpg\nassets/images/hero-3.jpg"),
        ],
        'about' => [
            'banner_title'  => $B('Banner title', 'text', 'About Us'),
            'lede'          => $B('Intro (HTML)', 'textarea', "The <strong>City Scholars' Association in PHINMA Cagayan de Oro College (CSAP)</strong> is a school-based organization that is responsible for overseeing scholars' welfare and development in PHINMA-COC."),
            'body'          => $B('Body (HTML)', 'textarea', 'With the tagline <em>“To Serve and Guide the Oro Scholars in PHINMA-COC,”</em> the organization aims to lead and equip the <strong>Iskolar Sa Dakbayan</strong> with the necessary skills and knowledge through engaging in different social initiatives that are anchored on four ladderized formations of the City Education Development Office — Leading the self; Leading Others; Leading the Community; and Leading the nation.'),
            'image'         => $B('About image', 'image', 'assets/images/about-us.jpg'),
            'mission_image' => $B('Mission image', 'image', 'assets/images/mission.jpg'),
            'mission_title' => $B('Mission title', 'text', 'Mission'),
            'mission_body'  => $B('Mission body (HTML)', 'textarea', "To strengthen the Scholar's participation in community development through a series of social action and formation activities and initiatives.\n\nTo uphold academic excellence and to create an inclusive environment for everyone."),
            'vision_image'  => $B('Vision image', 'image', 'assets/images/vision.jpg'),
            'vision_title'  => $B('Vision title', 'text', 'Vision'),
            'vision_body'   => $B('Vision body (HTML)', 'textarea', 'To become a school-based organization that enables every City Scholar to seize and appreciate open opportunities for individual betterment.\n\nTo fulfill this purpose, CSAP-COC endeavors to make a meaningful difference in the community through our succeeding programs.'),
        ],
        'history' => [
            'title'        => $B('Title', 'text', 'The Legacy of CSAP-COC: Our History'),
            'subtitle'     => $B('Subtitle', 'text', 'Building a Foundation for City Scholars — Est. 2019'),
            'intro'        => $B('Intro (HTML)', 'textarea', 'The story of the <strong>City Scholars Association in PHINMA COC (CSAP-COC)</strong> began with a mission to create a dedicated support system for the scholar community.'),
            'h1_title'     => $B('Foundation heading', 'text', '2019: The Foundation'),
            'h1_body'      => $B('Foundation body (HTML)', 'textarea', 'In 2019, <strong>Mr. Liam Aiken R. Osorio</strong> recognized the need for a unified voice and a structured organization to oversee the welfare of city scholars within PHINMA-Cagayan de Oro College. As the <strong>Founding President</strong>, he established the framework that continues to define our association today.'),
            'purpose_title'=> $B('Purpose heading', 'text', 'Our Purpose from Day One'),
            'purpose_body' => $B('Purpose body (HTML)', 'textarea', 'From its inception, CSAP-COC was built to be more than just a school-based organization. It was designed as a pillar of support, focusing on:'),
            'growth_title' => $B('Growth heading', 'text', 'A Growing Heritage'),
            'growth_body'  => $B('Growth body (HTML)', 'textarea', 'What started as a vision by Mr. Osorio has evolved into a vital part of the PHINMA-COC student experience. Since <strong>2019</strong>, we have remained committed to the development and success of every scholar who joins our family.'),
            'banner'       => $B('Banner image', 'image', 'assets/images/history-banner.png'),
        ],
        'leaders' => [
            'title' => $B('Section title', 'text', 'Our Lineage of Leadership'),
        ],
        'officers' => [
            'title' => $B('Section title', 'text', 'CSAP-COC Officers'),
        ],
        'contact' => [
            'title'          => $B('Section title', 'text', 'Contact Us'),
            'project_image'  => $B('Project image', 'image', 'assets/images/project-amigo.jpg'),
            'project_caption'=> $B('Project caption', 'text', 'CSAP-COC (Project Amigo Culminating Activity) — March 12, 2020'),
        ],
        'city_scholarship' => [
            'banner_title'   => $B('Banner title', 'text', 'All About City Scholarship'),
            'lede'           => $B('Lede (HTML)', 'textarea', 'The <a href="https://www.facebook.com/CDOCityScholarshipsOffice/" target="_blank" rel="noopener"><strong>Cagayan de Oro City Scholarship Program</strong></a> is a government-funded initiative that provides comprehensive financial aid, including full tuition and monthly stipends, to eligible Kagay-anon students. Managed by the <strong>City Scholarships Office</strong>, it offers various tracks for <em>academic overachievers</em>, <em>low-income families</em>, and even students pursuing <em>law or medical degrees</em>.'),
            'sdp_title'      => $B('SDP heading', 'text', 'Scholar Development Program (SDP)'),
            'sdp_body'       => $B('SDP body (HTML)', 'textarea', 'The <strong>Scholar Development Program (SDP)</strong> consists of activities that City Scholars are required to complete <strong>every semester</strong>. These activities may be conducted <strong>within the school</strong> or <strong>in the community/barangay</strong>, and are designed to promote leadership, service, and personal development among scholars.'),
            'sdp_types_title'=> $B('SDP types heading', 'text', 'Types of Scholar Development Program (SDP)'),
            'faq_title'      => $B('FAQ heading', 'text', 'Frequently Asked Questions'),
            'guide_title'    => $B('Guide heading', 'text', 'SDP Guide'),
            'guide_image'    => $B('Guide image', 'image', 'assets/images/faq-sdp-guide.png'),
        ],
        'hk_scholarship' => [
            'banner_title'      => $B('Banner title', 'text', 'All About Hawak-Kamay Scholarship'),
            'lede'             => $B('Lede (HTML)', 'textarea', 'The <strong>Hawak Kamay (HK) Scholarship</strong> is a financial aid program offered by <strong>PHINMA Education</strong> in the Philippines. It is designed to make college affordable for students from low-income families.'),
            'who_title'        => $B('Who can apply heading', 'text', 'Who Can Apply?'),
            'who_lines'        => $B('Who can apply (one per line)', 'lines', "Incoming First-Year College Students.\nTransferees (depending on the specific PHINMA campus policy).\nStudents with a strong desire to finish their degree despite financial challenges."),
            'benefits_title'   => $B('Benefits heading', 'text', 'Benefits of HK Scholarship'),
            'price_note'       => $B('Price note (HTML)', 'textarea', '<strong>Note:</strong> Books and uniforms are not included.'),
            'eligibility_title'=> $B('Eligibility heading', 'text', 'Eligibility & Requirements'),
            'eligibility_sub'  => $B('Eligibility sub-heading', 'text', 'Eligibility'),
            'eligibility_lines'=> $B('Eligibility list (one per line)', 'lines', "The student must be an incoming freshman.\nThe student must belong to a low-income family.\nThe student must pass the scholarship exam."),
            'requirements_sub' => $B('Requirements sub-heading', 'text', 'Requirements'),
            'requirements_body'=> $B('Requirements body (HTML)', 'textarea', 'Submit the following documents at the <strong>Marketing Department</strong>, on or before the set deadline:'),
            'requirements_lines'=> $B('Requirements list (one per line)', 'lines', "Form 137\nCertificate of Good Moral Character\nNSO Birth Certificate"),
            'maintenance'      => $B('Maintenance note (HTML)', 'textarea', '<strong>Maintenance:</strong> The scholarship extends for the normal life of the chosen program upon enrollment in first year. Must be able to render <strong>80 hours/semester</strong>.'),
            'exam_title'       => $B('Exam heading', 'text', 'Exam Permit and Guidelines'),
            'exam_lines'       => $B('Exam list (one per line)', 'lines', "Log in to your SIS account and download your exam permits.\nIf you weren't able to download your permit, you need to pay first your balance and go to assessment for approval.\nIf you don't have any balance, just go directly to the assessment for approval — just state that you are a city scholar."),
            'duty_title'       => $B('Duty heading', 'text', 'HK Scholarship Duty'),
            'duty_lines'       => $B('Duty list (one per line)', 'lines', 'After enrollment, the CSDL Office will email you regarding your duty assignment and its schedule.' . "\n" . "If you weren't able to accomplish your duty within the assigned schedule, you can directly go to the CSDL Office and look for Ma'am April Rose V. Selim so she can give you another duty assignment.\nCity Scholars are required to render 25 hours of duty to the department/office assigned to you."),
            'renewal_title'    => $B('Renewal heading', 'text', 'HK Scholarship Renewal'),
            'renewal_body'     => $B('Renewal body (HTML)', 'textarea', 'The renewal form and steps will be posted through <a href="https://www.facebook.com/groups/phinmacoccityscholars" target="_blank" rel="noopener">PHINMA COC City Scholar</a> and <a href="https://www.facebook.com/phinmacoccsdl" target="_blank" rel="noopener">PHINMA COC Center for Student Development and Leadership</a>.'),
            'renewal_sub'      => $B('Renewal sub-heading', 'text', 'Requirements needed for renewal'),
            'renewal_lines'    => $B('Renewal list (one per line)', 'lines', "Freshmen — School ID, HK Orientation, and HK LEADS.\nUpperclassmen — DTR signed by the department/office assigned to you.\nFourth Year — School ID only.\nWorking Student — Submit Certificate of Employment (COE)."),
            'renewal_note'     => $B('Renewal note (HTML)', 'textarea', '<strong>NOTE:</strong> Failure to renew the HK Scholarship means the scholarship will be untagged, and you will have to pay the remaining 50% of your tuition.'),
        ],
        'enrollment' => [
            'banner_title'       => $B('Banner title', 'text', 'All About Enrollment Process'),
            'title'              => $B('Title', 'text', 'Admission for Incoming Freshman'),
            'requirements_heading'=> $B('Requirements heading', 'text', 'Requirements'),
            'requirements_lines' => $B('Requirements (one per line)', 'lines', "PSA Birth Certificate\nForm 138 (Report Card)"),
            'walkin_title'       => $B('Walk-in heading', 'text', 'Walk-in Enrollment'),
            'online_title'       => $B('Online heading', 'text', 'Online Enrollment'),
            'online_note'        => $B('Online note (HTML)', 'textarea', '<strong>Note:</strong> Please only select <strong>Online Payment</strong> as your mode of payment.'),
        ],
        'announcements' => [
            'banner_title'  => $B('Banner title', 'text', 'Announcements'),
            'section_title' => $B('Section title', 'text', 'Organizational Memorandums'),
        ],
        'events' => [
            'banner_title' => $B('Banner title', 'text', 'Events and Stories'),
        ],
        'calendar' => [
            'banner_title' => $B('Banner title', 'text', 'Calendar'),
        ],
        'awards' => [
            'banner_title' => $B('Banner title', 'text', 'Awards and Recognition'),
            'title'        => $B('Title', 'text', 'Kinanao Awardee Through the Years'),
            'para1'        => $B('Paragraph 1 (HTML)', 'textarea', 'The <strong>Kinanao Awards</strong> is an annual recognition program in Cagayan de Oro City dedicated to honoring the exceptional achievements of city scholars and their organizations. Organized by the <strong>City Scholarships Office (CSO)</strong>, the name is derived from the Higaonon term <em>kinanao</em>, meaning “learner.”'),
            'para2'        => $B('Paragraph 2 (HTML)', 'textarea', 'Rather than focusing solely on grades, the awards celebrate scholars who demonstrate a holistic commitment to <strong>leadership, community service, and volunteerism</strong>. It serves as a prestigious platform to spotlight individuals and groups who embody the spirit of being “scholars for the people,” encouraging the city\'s youth to balance academic excellence with active civic engagement for the development of Northern Mindanao.'),
        ],
    ];
}

/* ---------------------------------------------------------------- collections */
function csap_collection_defaults(string $key): array
{
    switch ($key) {
        case 'nav_items':
            return [
                ['label' => 'Home', 'href' => '#home', 'sort_order' => 1, 'is_cta' => 0, 'children' => []],
                ['label' => 'About', 'href' => '#about', 'sort_order' => 2, 'is_cta' => 0, 'children' => [
                    ['label' => 'About Us', 'href' => '#about', 'sort_order' => 1],
                    ['label' => 'Mission & Vision', 'href' => '#mission-vision', 'sort_order' => 2],
                    ['label' => 'Lineage of Leadership', 'href' => '#lineage', 'sort_order' => 3],
                    ['label' => 'Our History', 'href' => '#history', 'sort_order' => 4],
                    ['label' => 'Officers', 'href' => '#officers', 'sort_order' => 5],
                    ['label' => 'Contact Us', 'href' => '#contact', 'sort_order' => 6],
                ]],
                ['label' => 'Scholarships', 'href' => '#city-scholarship', 'sort_order' => 3, 'is_cta' => 0, 'children' => [
                    ['label' => 'City Scholarship', 'href' => '#city-scholarship', 'sort_order' => 1],
                    ['label' => 'HK Scholarship', 'href' => '#hk-scholarship', 'sort_order' => 2],
                    ['label' => 'Enrollment Process', 'href' => '#enrollment', 'sort_order' => 3],
                ]],
                ['label' => 'Updates', 'href' => '#announcements', 'sort_order' => 4, 'is_cta' => 0, 'children' => [
                    ['label' => 'Announcements', 'href' => '#announcements', 'sort_order' => 1],
                    ['label' => 'Events and Stories', 'href' => '#events', 'sort_order' => 2],
                    ['label' => 'Calendar', 'href' => '#calendar', 'sort_order' => 3],
                ]],
                ['label' => 'Awards', 'href' => '#awards', 'sort_order' => 5, 'is_cta' => 0, 'children' => []],
                ['label' => 'Enroll Now', 'href' => '#enrollment', 'sort_order' => 6, 'is_cta' => 1, 'children' => []],
            ];

        case 'leaders':
            return [
                ['name' => 'Mr. Liam Aiken R. Osorio', 'position' => 'President (Founder)', 'term' => '2019-2020', 'is_current' => 0, 'sort_order' => 1],
                ['name' => 'Ms. Mary Jane Lumain, LPT', 'position' => 'President', 'term' => '2020-2021', 'is_current' => 0, 'sort_order' => 2],
                ['name' => 'Mr. Alawi Abdilla', 'position' => 'President', 'term' => '2021-2022', 'is_current' => 0, 'sort_order' => 3],
                ['name' => 'Ms. Lovely Mae Cabodbod, LPT', 'position' => 'President', 'term' => '2022-2023', 'is_current' => 0, 'sort_order' => 4],
                ['name' => 'Mr. Joel Lago', 'position' => 'President', 'term' => '2023-2024', 'is_current' => 0, 'sort_order' => 5],
                ['name' => 'Mr. Michael John Llovia', 'position' => 'President', 'term' => '2025', 'is_current' => 0, 'sort_order' => 6],
                ['name' => 'Ms. Mikyla Gwen Tabada', 'position' => 'President (Interim)', 'term' => '2026-Present', 'is_current' => 1, 'sort_order' => 7],
            ];

        case 'officers':
            // OFFICERS: every row carries a `school_year` (e.g. "2025-2026")
            // because the roster changes each school year. The rows below are
            // the default S.Y. 2025-2026 roster; the helper after the list
            // backfills the key so no row is ever missing it.
            $rows = [
                ['category' => 'Executives', 'department' => null, 'year_level' => null, 'role' => 'President', 'name' => 'Ms. Mikyla Gwen Tabada', 'sort_order' => 1],
                ['category' => 'Executives', 'department' => null, 'year_level' => null, 'role' => 'Vice President', 'name' => 'Ms. Jassell Ann Llesis', 'sort_order' => 2],
                ['category' => 'Executives', 'department' => null, 'year_level' => null, 'role' => 'General Secretary', 'name' => 'Mr. Johndel Tomada', 'sort_order' => 3],
                ['category' => 'Executives', 'department' => null, 'year_level' => null, 'role' => 'Associate Secretary', 'name' => 'Ms. Mary Antonette Limbaco', 'sort_order' => 4],
                ['category' => 'College Directors', 'department' => 'CMA', 'year_level' => null, 'role' => 'CMA Director', 'name' => 'Ms. Keara Zophiel Mulawan', 'sort_order' => 1],
                ['category' => 'College Directors', 'department' => 'COED', 'year_level' => null, 'role' => 'COED Director', 'name' => 'Ms. Mary Antonette Limbaco', 'sort_order' => 2],
                ['category' => 'College Directors', 'department' => 'SCCJ', 'year_level' => null, 'role' => 'SCCJ Director', 'name' => 'Ms. Carolyn L. Manaay', 'sort_order' => 3],
                ['category' => 'College Directors', 'department' => 'CAHS', 'year_level' => null, 'role' => 'CAHS Director', 'name' => 'Ms. Sittie Naawiah U. Angne', 'sort_order' => 4],
                ['category' => 'College Directors', 'department' => 'CITE', 'year_level' => null, 'role' => 'CITE Director', 'name' => 'Ms. KC Joy V. Asne', 'sort_order' => 5],
                ['category' => 'College Directors', 'department' => 'CEA', 'year_level' => null, 'role' => 'CEA Director', 'name' => 'Ms. Princess Gwyneth Candillada', 'sort_order' => 6],
                ['category' => 'Representatives', 'department' => 'CMA', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Ms. Arem Jane Camino', 'sort_order' => 1],
                ['category' => 'Representatives', 'department' => 'CMA', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Ms. Jazmine Reen V. Catalonia · Ms. Ellen Mae C. Dacillo', 'sort_order' => 2],
                ['category' => 'Representatives', 'department' => 'CMA', 'year_level' => '3rd Year', 'role' => 'Representative', 'name' => 'Mr. Marc Tristan M. Justalero · Ms. Patricia Ysabelle R. Arciaga', 'sort_order' => 3],
                ['category' => 'Representatives', 'department' => 'COED', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Ms. Cherejen D. Diva · Ms. Erich G. Sinogaya', 'sort_order' => 4],
                ['category' => 'Representatives', 'department' => 'COED', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Ms. Princess Shaina Tadeo · Ms. Jessa Mae Pagaran', 'sort_order' => 5],
                ['category' => 'Representatives', 'department' => 'COED', 'year_level' => '3rd Year', 'role' => 'Representative', 'name' => 'Ms. Jenierose Paelmariano · Ms. Charl Laine A. Roma', 'sort_order' => 6],
                ['category' => 'Representatives', 'department' => 'COED', 'year_level' => '4th Year', 'role' => 'Representative', 'name' => 'Mr. John Patrick Sagun', 'sort_order' => 7],
                ['category' => 'Representatives', 'department' => 'SCCJ', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Ms. Daisy Jean R. Clustre', 'sort_order' => 8],
                ['category' => 'Representatives', 'department' => 'SCCJ', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Ms. Francine Elise Cinco Bajao · Mr. Rassmusen D. Lapode', 'sort_order' => 9],
                ['category' => 'Representatives', 'department' => 'SCCJ', 'year_level' => '4th Year', 'role' => 'Representative', 'name' => 'Mr. Adrylle Kenzo E. Dumanon', 'sort_order' => 10],
                ['category' => 'Representatives', 'department' => 'CAHS', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Ms. Jasmine Jane G. Jabeniar', 'sort_order' => 11],
                ['category' => 'Representatives', 'department' => 'CAHS', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Mr. Floydjamil Diongal · Ms. Joanne Lourren O. Añor', 'sort_order' => 12],
                ['category' => 'Representatives', 'department' => 'CITE', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Mr. Ferd Denver O. Dulanas · Mr. Ken P. Torre', 'sort_order' => 13],
                ['category' => 'Representatives', 'department' => 'CITE', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Ms. Lian Suzaine Sultan', 'sort_order' => 14],
                ['category' => 'Representatives', 'department' => 'CITE', 'year_level' => '3rd Year', 'role' => 'Representative', 'name' => 'Ms. Princess Janelle I. Badana', 'sort_order' => 15],
                ['category' => 'Representatives', 'department' => 'CITE', 'year_level' => '4th Year', 'role' => 'Representative', 'name' => 'Ms. Jesse Ray Z. Morcillos', 'sort_order' => 16],
                ['category' => 'Representatives', 'department' => 'CEA', 'year_level' => '1st Year', 'role' => 'Representative', 'name' => 'Ms. Madhel T. Macayaon', 'sort_order' => 17],
                ['category' => 'Representatives', 'department' => 'CEA', 'year_level' => '2nd Year', 'role' => 'Representative', 'name' => 'Ms. Asliah M. Macarambon · Ms. Nicole Almoite', 'sort_order' => 18],
                ['category' => 'Representatives', 'department' => 'Puerto', 'year_level' => 'Representative', 'role' => 'Representative', 'name' => 'Ms. Anna Leah Zayas', 'sort_order' => 19],
                ['category' => 'Volunteer Scholars Development Committee', 'department' => 'Committee Head', 'year_level' => null, 'role' => 'Committee Head', 'name' => 'Ms. Bai Shadjidah Kasim', 'sort_order' => 1],
                ['category' => 'Volunteer Scholars Development Committee', 'department' => 'Grievances', 'year_level' => null, 'role' => 'Grievances Team', 'name' => 'Ms. Sohaila A. Alib · Mr. Rodnealy B. Tadle · Ms. Beverly Faith Abarquez', 'sort_order' => 2],
                ['category' => 'Volunteer Scholars Development Committee', 'department' => 'Guidance', 'year_level' => null, 'role' => 'Guidance Team', 'name' => 'Ms. Audrey M. Guzon · Ms. Jazreel Claire Q. Regodon · Ms. Althea Lucy Marie Relampagos', 'sort_order' => 3],
                ['category' => 'Volunteer Scholars Development Committee', 'department' => 'Academic', 'year_level' => null, 'role' => 'Academic Enhancement Team', 'name' => 'Ms. Chels Daiz Rebustes · Mr. Christian Dave Albellar · Ms. Uzzielyn B. Nermal', 'sort_order' => 4],
                ['category' => 'Scholarship Coordinator', 'department' => null, 'year_level' => null, 'role' => 'School Coordinator', 'name' => 'Ms. April Rose V. Selim', 'sort_order' => 1],
                ['category' => 'Scholarship Coordinator', 'department' => null, 'year_level' => null, 'role' => 'CEDO School-Based Coordinator', 'name' => 'Mr. Ian Xien Hinacay', 'sort_order' => 2],
            ];
            // Backfill school_year so every default officer belongs to a year.
            foreach ($rows as &$r) {
                if (empty($r['school_year'])) {
                    $r['school_year'] = '2025-2026';
                }
            }
            unset($r);
            return $rows;

        case 'announcements':
            return [
                ['title' => 'Memorandum 001, s. 2526', 'document_url' => 'https://tinyurl.com/bdc3z3m3', 'image' => 'assets/images/memorandum-001.jpg', 'category' => 'Memorandum', 'published_at' => null, 'sort_order' => 1],
                ['title' => 'Memorandum 002, s. 2526', 'document_url' => 'https://tinyurl.com/CSAP-COC-MM02', 'image' => 'assets/images/memorandum-002.jpg', 'category' => 'Memorandum', 'published_at' => null, 'sort_order' => 2],
                ['title' => 'Memorandum 003, s. 2526', 'document_url' => 'http://bit.ly/4pDu7fu', 'image' => 'assets/images/memorandum-003.jpg', 'category' => 'Memorandum', 'published_at' => null, 'sort_order' => 3],
                ['title' => 'Executive Order 001, s. 2526', 'document_url' => 'https://tinyurl.com/y9kf3fu6', 'image' => 'assets/images/executive-order-001.jpg', 'category' => 'Executive Order', 'published_at' => null, 'sort_order' => 4],
            ];

        case 'events':
            return [
                ['title' => 'City Scholar Association in PHINMA-COC (CSAP-COC)', 'kind' => 'event', 'image' => 'assets/images/event-csap.jpg', 'link_url' => 'https://www.facebook.com/csapcoc', 'published_at' => null, 'sort_order' => 1],
                ['title' => 'City Educational and Development Office (CEDO)', 'kind' => 'event', 'image' => 'assets/images/event-cedo.jpg', 'link_url' => 'https://www.facebook.com/CDOCityScholarshipsOffice', 'published_at' => null, 'sort_order' => 2],
                ['title' => 'Notice of Resignation', 'kind' => 'story', 'image' => '', 'link_url' => 'https://www.facebook.com/share/p/18xz141uEk/', 'published_at' => null, 'sort_order' => 3],
                ['title' => '7th PHINMA Student Leaders’ Summit in Manila.', 'kind' => 'story', 'image' => '', 'link_url' => 'https://www.facebook.com/share/p/14YoSpPkSnY/', 'published_at' => null, 'sort_order' => 4],
            ];

        case 'awardees':
            return [
                ['name' => 'Lovely Mae Cabodbod, LPT', 'award' => 'Kinanao Awards 2025 — Pablo Magtajas Leadership Awardee', 'year' => 2025, 'image' => 'assets/images/awardee-cabodbod.jpg', 'sort_order' => 1],
                ['name' => 'Liam Aiken R. Osorio', 'award' => 'Kinanao Awards 2018 — Pablo Magtajas Leadership Awardee', 'year' => 2018, 'image' => 'assets/images/awardee-osorio.jpg', 'sort_order' => 2],
                ['name' => 'City Scholars Association in PHINMA COC', 'award' => 'Outstanding Organization Awards: School-Based', 'year' => null, 'image' => 'assets/images/awardee-csap-org.jpg', 'sort_order' => 3],
                ['name' => 'Michael John Llovia', 'award' => 'Kinanao Awards 2025 — Outstanding Volunteer of the Year Awardee', 'year' => 2025, 'image' => 'assets/images/awardee-llovia.jpg', 'sort_order' => 4],
            ];

        case 'faqs':
            return [
                ['category' => 'SDP', 'question' => 'How many SDPs are we going to render per semester?', 'answer' => '7 SDP per semester.', 'sort_order' => 1],
                ['category' => 'GC', 'question' => 'How to join my College Group chat?', 'answer' => 'Message the college director and representative from your respective department and send them your CSR as proof that you are a city scholar grantee.', 'sort_order' => 2],
                ['category' => 'Scholarship', 'question' => 'Why are we a City Scholar and HK Scholar at the same time?', 'answer' => 'There is an agreement between the CEDO and PHINMA COC that once you are a city scholar and you enroll at COC, you will automatically have two (2) scholarships: the Internal Scholarship (HK 50%) and the External Scholarship (City Scholar 50%).', 'sort_order' => 3],
                ['category' => 'Scholarship', 'question' => 'Do we have to render both City Scholar and HK Scholar duties?', 'answer' => 'Yes, we have to render both City Scholar and HK duties. Failure to do so will result in the untagging of the scholarship.', 'sort_order' => 4],
                ['category' => 'Scholarship', 'question' => 'When do we renew our scholarship?', 'answer' => 'Both HK and City scholarships should be renewed every after the semester.', 'sort_order' => 5],
                ['category' => 'Scholarship', 'question' => 'I haven’t met the required GWA, does that mean I am no longer a city scholar?', 'answer' => 'You will be called by the CEDO and will be marked as on-probation. If your grades don’t improve and still don’t meet the required GWA, that is the time you will be removed as a city scholar.', 'sort_order' => 6],
                ['category' => 'Scholarship', 'question' => 'If I lose my City Scholarship, will my HK Scholarship still remain?', 'answer' => 'Yes. You still have your HK Scholarship, since it doesn’t have a grade requirement.', 'sort_order' => 7],
                ['category' => 'Scholarship', 'question' => 'If I haven’t renewed my City Scholarship from the CEDO, will my scholarship be removed?', 'answer' => 'Yes, because it is stated in the contract that we are required to renew our scholarship and render our SDP every semester.', 'sort_order' => 8],
            ];

        case 'contact_cards':
            return [
                ['label' => 'Facebook Page', 'value' => 'CSAP-COC', 'url' => 'https://www.facebook.com/csapcoc', 'image' => 'assets/images/contact-facebook.jpg', 'sort_order' => 1],
                ['label' => 'CSAP-COC Email', 'value' => 'coccsap@gmail.com', 'url' => 'mailto:coccsap@gmail.com', 'image' => 'assets/images/contact-csap-email.png', 'sort_order' => 2],
                ['label' => 'Palayaw Email', 'value' => 'palayawcsapcoc@gmail.com', 'url' => 'mailto:palayawcsapcoc@gmail.com', 'image' => 'assets/images/contact-palayaw-email.png', 'sort_order' => 3],
            ];

        case 'history_pillars':
            return [
                ['title' => 'Scholar Advocacy', 'body' => 'Ensuring the needs and voices of city scholars are heard.', 'sort_order' => 1],
                ['title' => 'Holistic Development', 'body' => 'Creating opportunities for growth beyond the classroom.', 'sort_order' => 2],
                ['title' => 'Community Welfare', 'body' => 'Building a “home” where every scholar feels valued and protected.', 'sort_order' => 3],
            ];

        case 'sdp_types':
            return [
                ['title' => '1. Community Volunteerism', 'body' => '<strong>Week-long or month-long activities</strong> usually implemented by community-based organizations that address community needs and promote civic engagement.', 'items' => '', 'sort_order' => 1],
                ['title' => '2. Ladderized Activities', 'body' => 'Implemented by the <strong>City Education Office (CEDO)</strong> to develop scholars’ leadership and character formation. Examples:', 'items' => "KATIG\nISLA Modules\nSchool-based & Community-based General Assembly\nFIOGET", 'sort_order' => 2],
                ['title' => '3. Institutionalized Volunteerism', 'body' => '<strong>One-shot or short-term volunteer activities</strong> within the school, community, or through CEDO. Examples:', 'items' => "Klarex na Kalimpyo\nCEDO Calls for Volunteers\nSchool-based & Community-based initiated activities", 'sort_order' => 3],
            ];

        case 'hk_features':
            return [
                ['title' => 'Fixed Low Tuition', 'body' => 'A consistent, discounted rate of ₱5,500 to ₱12,500 per semester (rates vary by school/program).', 'sort_order' => 1],
                ['title' => 'No Entrance Exams', 'body' => 'Admission is based on your determination to learn, not a high-pressure test.', 'sort_order' => 2],
                ['title' => 'No Maintaining Grade', 'body' => 'As long as you pass your subjects, you keep your scholarship.', 'sort_order' => 3],
                ['title' => 'Guaranteed Coverage', 'body' => 'The discount applies from your first year until you graduate.', 'sort_order' => 4],
            ];

        case 'hk_prices':
            return [
                ['code' => 'HK5.5', 'price' => '₱5,500 per semester', 'sort_order' => 1],
                ['code' => 'HK7.5', 'price' => 'as low as ₱7,500 per semester', 'sort_order' => 2],
                ['code' => 'HK10', 'price' => 'as low as ₱10,000 per semester', 'sort_order' => 3],
                ['code' => 'HK12.5', 'price' => 'as low as ₱12,000 per semester', 'sort_order' => 4],
            ];

        case 'enrollment_steps':
            return [
                ['mode' => 'walkin', 'title' => 'Fill out your enrollment form', 'body' => 'at the Marketing Office.', 'sort_order' => 1],
                ['mode' => 'walkin', 'title' => 'Pay the enrollment fee', 'body' => '₱750 (HK Grantee) · ₱1,000 (Regular student)', 'sort_order' => 2],
                ['mode' => 'walkin', 'title' => 'Get your ORF or Class schedule', 'body' => 'at the assessment area.', 'sort_order' => 3],
                ['mode' => 'walkin', 'title' => 'Go back to the Marketing Office', 'body' => 'for orientation and get your welcome kit.', 'sort_order' => 4],
                ['mode' => 'online', 'title' => 'Fill out the online enrollment form', 'body' => '» Register Here « — https://linktr.ee/phinmacoc', 'sort_order' => 1],
                ['mode' => 'online', 'title' => 'Check your email', 'body' => 'If you received a notification of your successful registration receipt.', 'sort_order' => 2],
                ['mode' => 'online', 'title' => 'Wait for our team to call you', 'body' => 'and guide you on to the next process. Check your email for your class schedule or ORF.', 'sort_order' => 3],
            ];

        // -- CALENDAR ---------------------------------------------------------
        // Regular Philippine public holidays + a couple of school events so the
        // calendar is never empty on a fresh install. Years are parsed from
        // ISO dates below; `date_end` is kept null (single-day entries).
        case 'calendar_entries':
            $y = (int) date('n') >= 8 ? (int) date('Y') : (int) date('Y') - 1;   // school-year start
            $holidays = [
                '01-01' => "New Year's Day",
                '02-25' => 'EDSA People Power Revolution Anniversary',
                '04-09' => 'Araw ng Kagitingan (Day of Valor)',
                '05-01' => 'Labor Day',
                '06-12' => 'Independence Day',
                '08-21' => 'Ninoy Aquino Day',
                '08-28' => 'National Heroes Day',
                '11-01' => "All Saints' Day",
                '11-02' => "All Souls' Day",
                '11-30' => 'Bonifacio Day',
                '12-08' => 'Feast of the Immaculate Conception',
                '12-25' => 'Christmas Day',
                '12-30' => 'Rizal Day',
            ];
            $out = [];
            $n = 0;
            foreach ($holidays as $md => $name) {
                list($m, $d) = array_map('intval', explode('-', $md));
                // Jan–Jul belongs to the school year that started the year before.
                $year = ($m >= 8) ? $y : $y - 1;
                $n++;
                $out[] = [
                    'title' => $name, 'kind' => 'holiday', 'source' => 'school',
                    'date_start' => sprintf('%04d-%02d-%02d', $year, $m, $d), 'date_end' => null,
                    'all_day' => 1, 'time_from' => null, 'time_to' => null, 'location' => null,
                    'description' => 'Regular national holiday — no classes.', 'is_highlight' => 0, 'sort_order' => $n,
                ];
            }
            $out[] = [
                'title' => 'First Day of Classes', 'kind' => 'school_event', 'source' => 'school',
                'date_start' => sprintf('%04d-08-01', $y), 'date_end' => null,
                'all_day' => 1, 'time_from' => null, 'time_to' => null, 'location' => 'PHINMA COC',
                'description' => 'Opening of classes for the school year.', 'is_highlight' => 1, 'sort_order' => ++$n,
            ];
            $out[] = [
                'title' => 'Semestral Break', 'kind' => 'school_event', 'source' => 'school',
                'date_start' => sprintf('%04d-10-26', $y), 'date_end' => sprintf('%04d-10-31', $y),
                'all_day' => 1, 'time_from' => null, 'time_to' => null, 'location' => null,
                'description' => 'No classes during the semestral break.', 'is_highlight' => 1, 'sort_order' => ++$n,
            ];
            return $out;
    }
    return [];
}