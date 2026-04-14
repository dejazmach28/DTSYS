package transport

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net/url"
	"time"
)

// BuildTLSConfig creates a TLS config that can optionally ignore time skew
// while still validating hostnames and certificate chains.
func BuildTLSConfig(serverURL string, skipTimeCheck bool) *tls.Config {
	u, err := url.Parse(serverURL)
	if err != nil {
		return &tls.Config{}
	}
	serverName := u.Hostname()
	if serverName == "" {
		return &tls.Config{}
	}
	if !skipTimeCheck {
		return &tls.Config{ServerName: serverName}
	}

	return &tls.Config{
		ServerName:         serverName,
		InsecureSkipVerify: true,
		VerifyConnection: func(cs tls.ConnectionState) error {
			if len(cs.PeerCertificates) == 0 {
				return errors.New("no peer certificate")
			}
			opts := x509.VerifyOptions{
				DNSName:       serverName,
				Intermediates: x509.NewCertPool(),
			}
			for _, cert := range cs.PeerCertificates[1:] {
				opts.Intermediates.AddCert(cert)
			}
			opts.CurrentTime = cs.PeerCertificates[0].NotBefore.Add(time.Minute)
			_, err := cs.PeerCertificates[0].Verify(opts)
			return err
		},
	}
}
