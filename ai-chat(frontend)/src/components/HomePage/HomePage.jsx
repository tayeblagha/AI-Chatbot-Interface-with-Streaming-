import Image from 'next/image';
import Link from 'next/link';
import styles from './HomePage.module.css';

const HomePage = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className={styles.heroArea}>
      {/* Hero Section with Phone Image */}
      <div>
        <section className={styles.heroSection}>
          <div className={styles.phoneContainer}>
            <div className={styles.phoneImageWrapper}>
              <Image
                src="/images/aiassitant.png"
                alt="AI Assistant Preview"
                width={400}
                height={400}
                className={styles.scrollingPhone}
              />
            </div>
          </div>
          <div className="-mt-16 ml-12">
            <div className={styles.heroContent}>
              <p className={styles.heroText}>
                Experience the Future of Smart Digital Assistants
              </p>
              <div className={styles.buttonContainer}>
                <Link href="/login" className={styles.ctaButton}>
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white py-4 mt-16">
        <div className="text-center">
          <p>&copy; {currentYear} All Rights Reserved</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
